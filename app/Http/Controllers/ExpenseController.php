<?php

namespace App\Http\Controllers;

use App\Models\BuildProject;
use App\Models\Expense;
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
            ->with('success', 'Expense added successfully.');
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
            ->with('success', 'Expense updated successfully.');
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
            ->with('success', 'Expense deleted successfully.');
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
        // Financial fields are managed from Project Financials / Payments.
        // Expense updates should not overwrite manual financial snapshots.
        return;
    }
}
