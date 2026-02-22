<?php

namespace App\Http\Controllers;

use App\Models\BuildProject;
use App\Models\DesignProject;
use App\Models\Expense;
use App\Models\Project;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request, string $project)
    {
        $this->ensureAuthorized($request);

        if (!$request->expectsJson()) {
            return redirect()->route('build.show', [
                'project' => $project,
                'tab' => 'expenses',
            ]);
        }

        $expenses = Expense::where('project_id', $project)
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get();

        $totalExpenses = (float) $expenses->sum('amount');
        $constructionContract = (float) (BuildProject::where('project_id', $project)->value('construction_contract') ?? 0);

        return response()->json([
            'project_id' => (string) $project,
            'expenses' => $expenses,
            'total_expenses' => $totalExpenses,
            'remaining_income' => $constructionContract - $totalExpenses,
        ]);
    }

    public function store(Request $request, string $project)
    {
        $this->ensureAuthorized($request);

        $validated = $request->validate([
            'category' => 'required|string|max:100',
            'amount' => 'required|numeric|min:0',
            'note' => 'nullable|string|max:1000',
            'date' => 'required|date',
        ]);

        Expense::create([
            'project_id' => $project,
            ...$validated,
        ]);

        $this->syncProjectFinancials($project);

        return redirect()
            ->route('build.show', [
                'project' => $project,
                'tab' => 'expenses',
                ...$this->expenseTableQueryParams($request),
            ])
            ->with('success', 'Expense added.');
    }

    public function update(Request $request, Expense $expense)
    {
        $this->ensureAuthorized($request);

        $validated = $request->validate([
            'category' => 'required|string|max:100',
            'amount' => 'required|numeric|min:0',
            'note' => 'nullable|string|max:1000',
            'date' => 'required|date',
        ]);

        $expense->update($validated);

        $this->syncProjectFinancials((string) $expense->project_id);

        return redirect()
            ->route('build.show', [
                'project' => $expense->project_id,
                'tab' => 'expenses',
                ...$this->expenseTableQueryParams($request),
            ])
            ->with('success', 'Expense updated.');
    }

    public function destroy(Request $request, Expense $expense)
    {
        $this->ensureAuthorized($request);

        $projectId = $expense->project_id;
        $expense->delete();
        $this->syncProjectFinancials((string) $projectId);

        return redirect()
            ->route('build.show', [
                'project' => $projectId,
                'tab' => 'expenses',
                ...$this->expenseTableQueryParams($request),
            ])
            ->with('success', 'Expense deleted.');
    }

    private function ensureAuthorized(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);
    }

    private function expenseTableQueryParams(Request $request): array
    {
        return array_filter([
            'expense_search' => $request->query('expense_search'),
            'expense_per_page' => $request->query('expense_per_page'),
            'expense_page' => $request->query('expense_page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function syncProjectFinancials(string $projectId): void
    {
        $design = DesignProject::where('project_id', $projectId)->first();
        $build = BuildProject::where('project_id', $projectId)->first();

        $designContractAmount = (float) ($design?->design_contract_amount ?? 0);
        $designTotalReceived = (float) ($design?->total_received ?? 0);

        $constructionContract = (float) ($build?->construction_contract ?? 0);
        $buildTotalClientPayment = (float) ($build?->total_client_payment ?? 0);
        $designProgress = (float) ($design?->design_progress ?? 0);

        $expenseConstructionCost = (float) Expense::where('project_id', $projectId)->sum('amount');
        $constructionCost = $expenseConstructionCost;
        $hasBuildData = $constructionContract > 0 || $buildTotalClientPayment > 0 || $constructionCost > 0;
        $buildProgress = $constructionContract > 0
            ? ($buildTotalClientPayment / $constructionContract) * 100
            : 0;
        $overallProgress = $hasBuildData
            ? (int) round(max(0, min(100, ($designProgress + $buildProgress) / 2)))
            : (int) round(max(0, min(100, $designProgress)));

        Project::whereKey($projectId)->update([
            'contract_amount' => $designContractAmount + $constructionContract,
            'design_fee' => $designContractAmount,
            'construction_cost' => $constructionCost,
            'total_client_payment' => $designTotalReceived + $buildTotalClientPayment,
            'overall_progress' => $overallProgress,
        ]);
    }
}
