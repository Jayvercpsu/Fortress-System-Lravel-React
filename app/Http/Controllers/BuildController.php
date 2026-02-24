<?php

namespace App\Http\Controllers;

use App\Models\BuildProject;
use App\Models\DesignProject;
use App\Models\Expense;
use App\Models\Material;
use App\Models\Payment;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class BuildController extends Controller
{
    public function show(Request $request, string $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

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
            ->with('success', 'Build tracker updated.');
    }

    private function syncProjectFinancials(string $projectId): void
    {
        $design = DesignProject::where('project_id', $projectId)->first();
        $build = BuildProject::where('project_id', $projectId)->first();

        $designContractAmount = (float) ($design?->design_contract_amount ?? 0);

        $constructionContract = (float) ($build?->construction_contract ?? 0);
        $totalClientPayment = (float) Payment::where('project_id', $projectId)->sum('amount');
        $lastPaidDate = Payment::where('project_id', $projectId)->max('date_paid');

        $expenseConstructionCost = (float) Expense::where('project_id', $projectId)->sum('amount');
        $constructionCost = $expenseConstructionCost;
        $contractAmount = $designContractAmount + $constructionContract;

        Project::whereKey($projectId)->update([
            'contract_amount' => $contractAmount,
            'construction_cost' => $constructionCost,
            'total_client_payment' => $totalClientPayment,
            'remaining_balance' => $contractAmount - $totalClientPayment,
            'last_paid_date' => $lastPaidDate,
        ]);
    }
}
