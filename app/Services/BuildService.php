<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\Expense;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\BuildRepositoryInterface;
use Illuminate\Http\Request;

class BuildService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly BuildRepositoryInterface $buildRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function pageByRole(User $user): string
    {
        return $user->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Build/Show'
            : 'Admin/Build/Show';
    }

    public function showPayload(Request $request, string $projectId): array
    {
        $project = $this->buildRepository->findProjectOrFail($projectId);

        $build = $this->buildRepository->firstOrCreateBuildByProjectId($projectId);
        $constructionContract = (float) $build->construction_contract;
        $totalClientPayment = (float) $build->total_client_payment;

        $payload = [
            'project_id' => $build->project_id,
            'construction_contract' => $constructionContract,
            'total_client_payment' => $totalClientPayment,
            'materials_cost' => (float) $build->materials_cost,
            'labor_cost' => (float) $build->labor_cost,
            'equipment_cost' => (float) $build->equipment_cost,
            'total_expenses' => 0,
            'remaining_budget' => $totalClientPayment,
            'budget_vs_actual' => $constructionContract,
            'payment_progress' => $constructionContract > 0
                ? round(($totalClientPayment / $constructionContract) * 100, 2)
                : 0,
        ];

        $expenseSearch = trim((string) $request->query('expense_search', ''));
        $expensePerPage = (int) $request->query('expense_per_page', 5);
        if (!in_array($expensePerPage, self::ALLOWED_PER_PAGE, true)) {
            $expensePerPage = 5;
        }

        $expenseTotal = $this->buildRepository->expenseTotal($projectId);
        $expenseCategoryTotals = $this->buildRepository->expenseCategoryTotals($projectId);
        $materialOptions = $this->buildRepository->materialOptions();

        $expensePaginator = $this->buildRepository->paginatedExpenses($projectId, $expenseSearch, $expensePerPage);
        $expenses = collect($expensePaginator->items())
            ->map(fn ($expense) => [
                'id' => $expense->id,
                'project_id' => $expense->project_id,
                'category' => $expense->category ?: Expense::CATEGORY_UNCATEGORIZED,
                'amount' => (float) $expense->amount,
                'note' => $expense->note,
                'date' => optional($expense->date)->toDateString(),
            ])
            ->values();

        $scopesQuery = $this->buildRepository->scopesWithPhotos($project);
        if ($scopesQuery->isEmpty()) {
            $this->buildRepository->insertDefaultScopes($project, $this->defaultConstructionScopes());
            $scopesQuery = $this->buildRepository->scopesWithPhotos($project);
        }

        $scopes = $scopesQuery
            ->map(fn (ProjectScope $scope) => [
                'id' => $scope->id,
                'project_id' => $scope->project_id,
                'scope_name' => $scope->scope_name,
                'assigned_personnel' => $scope->assigned_personnel,
                'progress_percent' => (int) $scope->progress_percent,
                'status' => $scope->status,
                'remarks' => $scope->remarks,
                'contract_amount' => (float) ($scope->contract_amount ?? 0),
                'weight_percent' => (float) ($scope->weight_percent ?? 0),
                'start_date' => optional($scope->start_date)?->toDateString(),
                'target_completion' => optional($scope->target_completion)?->toDateString(),
                'updated_at' => optional($scope->updated_at)?->toDateTimeString(),
                'photos' => $scope->photos->map(fn ($photo) => [
                    'id' => $photo->id,
                    'photo_path' => $photo->photo_path,
                    'caption' => $photo->caption,
                    'created_at' => optional($photo->created_at)?->toDateTimeString(),
                ])->values(),
            ])
            ->values();

        $payload['total_expenses'] = $expenseTotal;
        $payload['remaining_budget'] = $totalClientPayment - $expenseTotal;
        $payload['budget_vs_actual'] = $constructionContract - $expenseTotal;

        return [
            'projectId' => (string) $projectId,
            'build' => $payload,
            'expenses' => $expenses,
            'expenseCategoryTotals' => $expenseCategoryTotals,
            'materialOptions' => $materialOptions,
            'expenseTable' => [
                'search' => $expenseSearch,
                'per_page' => $expensePaginator->perPage(),
                'current_page' => $expensePaginator->currentPage(),
                'last_page' => max(1, $expensePaginator->lastPage()),
                'total' => $expensePaginator->total(),
                'from' => $expensePaginator->firstItem(),
                'to' => $expensePaginator->lastItem(),
            ],
            'expenseTotal' => $expenseTotal,
            'remainingIncome' => $constructionContract - $expenseTotal,
            'monitoring' => [
                'project' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'overall_progress' => (int) $project->overall_progress,
                    'status' => $project->status,
                ],
                'scopes' => $scopes,
                'foreman_options' => $this->buildRepository->projectForemanOptions($project),
            ],
        ];
    }

    public function updateBuild(string $projectId, array $validated): void
    {
        $existing = $this->buildRepository->findBuildByProjectId($projectId);
        $validated['materials_cost'] = (float) ($validated['materials_cost'] ?? $existing?->materials_cost ?? 0);
        $validated['labor_cost'] = (float) ($validated['labor_cost'] ?? $existing?->labor_cost ?? 0);
        $validated['equipment_cost'] = (float) ($validated['equipment_cost'] ?? $existing?->equipment_cost ?? 0);

        $this->buildRepository->updateOrCreateBuildByProjectId($projectId, $validated);
        $this->syncProjectFinancials($projectId);
    }

    private function syncProjectFinancials(string $projectId): void
    {
        // Financial fields are managed from Project Financials / Payments.
        // Tracker updates should not overwrite manual financial snapshots.
        return;
    }

    private function defaultConstructionScopes(): array
    {
        return WeeklyAccomplishment::defaultScopeOfWorks();
    }
}
