<?php

namespace App\Http\Controllers;

use App\Models\BuildProject;
use App\Models\Expense;
use App\Models\Material;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class BuildController extends Controller
{
    public function show(Request $request, string $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $projectModel = Project::findOrFail($project);

        $build = BuildProject::firstOrCreate(
            ['project_id' => $project],
            [
                'construction_contract' => 0,
                'total_client_payment' => 0,
                'materials_cost' => 0,
                'labor_cost' => 0,
                'equipment_cost' => 0,
            ]
        );

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
        $allowedPerPage = [5, 10, 25, 50];
        $expensePerPage = (int) $request->query('expense_per_page', 5);
        if (!in_array($expensePerPage, $allowedPerPage, true)) {
            $expensePerPage = 5;
        }

        $allExpensesQuery = Expense::query()->where('project_id', $project);
        $expenseTotal = (float) (clone $allExpensesQuery)->sum('amount');

        $expenseCategoryTotals = (clone $allExpensesQuery)
            ->get(['category', 'amount'])
            ->groupBy(fn (Expense $expense) => trim((string) ($expense->category ?: 'uncategorized')) ?: 'uncategorized')
            ->map(fn ($group, $category) => [
                'category' => $category,
                'amount' => (float) $group->sum('amount'),
            ])
            ->sortByDesc('amount')
            ->values();

        $materialOptions = [];
        if (Schema::hasTable('materials')) {
            $materialOptions = Material::query()
                ->orderBy('name')
                ->pluck('name')
                ->filter(fn ($name) => trim((string) $name) !== '')
                ->values();
        }

        $expenseTableQuery = Expense::query()->where('project_id', $project);
        if ($expenseSearch !== '') {
            $expenseTableQuery->where(function ($query) use ($expenseSearch) {
                $query
                    ->where('category', 'like', "%{$expenseSearch}%")
                    ->orWhere('note', 'like', "%{$expenseSearch}%")
                    ->orWhere('date', 'like', "%{$expenseSearch}%");
            });
        }

        $expensePaginator = $expenseTableQuery
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate($expensePerPage, ['id', 'project_id', 'category', 'amount', 'note', 'date'], 'expense_page')
            ->withQueryString();

        $expenses = collect($expensePaginator->items())
            ->map(fn (Expense $expense) => [
                'id' => $expense->id,
                'project_id' => $expense->project_id,
                'category' => $expense->category,
                'amount' => (float) $expense->amount,
                'note' => $expense->note,
                'date' => optional($expense->date)->toDateString(),
            ])
            ->values();

        $scopes = $projectModel->scopes()
            ->with(['photos' => fn ($query) => $query->latest('id')])
            ->latest('id')
            ->get()
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

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Build/Show'
            : 'Admin/Build/Show';

        return Inertia::render($page, [
            'projectId' => (string) $project,
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
                    'id' => $projectModel->id,
                    'name' => $projectModel->name,
                    'overall_progress' => (int) $projectModel->overall_progress,
                    'status' => $projectModel->status,
                ],
                'scopes' => $scopes,
                'foreman_options' => $this->projectForemanOptions($projectModel),
            ],
        ]);
    }

    public function update(Request $request, string $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate([
            'construction_contract' => 'required|numeric|min:0',
            'total_client_payment' => 'required|numeric|min:0',
            'materials_cost' => 'nullable|numeric|min:0',
            'labor_cost' => 'nullable|numeric|min:0',
            'equipment_cost' => 'nullable|numeric|min:0',
        ]);

        $existing = BuildProject::where('project_id', $project)->first();
        $validated['materials_cost'] = (float) ($validated['materials_cost'] ?? $existing?->materials_cost ?? 0);
        $validated['labor_cost'] = (float) ($validated['labor_cost'] ?? $existing?->labor_cost ?? 0);
        $validated['equipment_cost'] = (float) ($validated['equipment_cost'] ?? $existing?->equipment_cost ?? 0);

        BuildProject::updateOrCreate(
            ['project_id' => $project],
            $validated
        );

        $this->syncProjectFinancials($project);

        return redirect()
            ->route('build.show', ['project' => $project])
            ->with('success', 'Build tracker updated successfully.');
    }

    private function syncProjectFinancials(string $projectId): void
    {
        // Financial fields are managed from Project Financials / Payments.
        // Tracker updates should not overwrite manual financial snapshots.
        return;
    }

    private function projectForemanOptions(Project $project): array
    {
        $assignedForemanIds = ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->where('role_in_project', 'foreman')
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        return User::query()
            ->where('role', 'foreman')
            ->when(
                $assignedForemanIds->isNotEmpty(),
                fn ($query) => $query->whereIn('id', $assignedForemanIds->all()),
                fn ($query) => $query->whereRaw('1 = 0')
            )
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $user) => [
                'id' => (int) $user->id,
                'fullname' => trim((string) ($user->fullname ?? '')),
            ])
            ->filter(fn (array $row) => $row['fullname'] !== '')
            ->values()
            ->all();
    }
}
