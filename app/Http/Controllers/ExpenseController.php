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

        return redirect()
            ->route('build.show', ['project' => $project, 'tab' => 'expenses'])
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

        return redirect()
            ->route('build.show', ['project' => $expense->project_id, 'tab' => 'expenses'])
            ->with('success', 'Expense updated.');
    }

    public function destroy(Request $request, Expense $expense)
    {
        $this->ensureAuthorized($request);

        $projectId = $expense->project_id;
        $expense->delete();

        return redirect()
            ->route('build.show', ['project' => $projectId, 'tab' => 'expenses'])
            ->with('success', 'Expense deleted.');
    }

    private function ensureAuthorized(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);
    }
}
