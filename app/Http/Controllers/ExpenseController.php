<?php

namespace App\Http\Controllers;

use App\Http\Requests\Expenses\StoreExpenseRequest;
use App\Http\Requests\Expenses\UpdateExpenseRequest;
use App\Models\Expense;
use App\Services\ExpenseService;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function __construct(
        private readonly ExpenseService $expenseService
    ) {
    }

    public function index(Request $request, string $project)
    {
        $this->expenseService->ensureAuthorized($request->user());

        if (!$request->expectsJson()) {
            return redirect()->route('build.show', [
                'project' => $project,
                'tab' => 'expenses',
            ]);
        }

        return response()->json($this->expenseService->indexJsonPayload($project));
    }

    public function store(StoreExpenseRequest $request, string $project)
    {
        $this->expenseService->ensureAuthorized($request->user());
        $this->expenseService->createExpense($project, $request->validated());

        return redirect()
            ->route('build.show', [
                'project' => $project,
                'tab' => 'expenses',
                ...$this->expenseService->expenseTableQueryParams($request),
            ])
            ->with('success', __('messages.expenses.created'));
    }

    public function update(UpdateExpenseRequest $request, Expense $expense)
    {
        $this->expenseService->ensureAuthorized($request->user());
        $this->expenseService->updateExpense($expense, $request->validated());

        return redirect()
            ->route('build.show', [
                'project' => $expense->project_id,
                'tab' => 'expenses',
                ...$this->expenseService->expenseTableQueryParams($request),
            ])
            ->with('success', __('messages.expenses.updated'));
    }

    public function destroy(Request $request, Expense $expense)
    {
        $this->expenseService->ensureAuthorized($request->user());
        $projectId = $expense->project_id;
        $this->expenseService->deleteExpense($expense);

        return redirect()
            ->route('build.show', [
                'project' => $projectId,
                'tab' => 'expenses',
                ...$this->expenseService->expenseTableQueryParams($request),
            ])
            ->with('success', __('messages.expenses.deleted'));
    }
}
