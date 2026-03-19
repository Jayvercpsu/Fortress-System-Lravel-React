<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\User;
use App\Repositories\Contracts\ExpenseRepositoryInterface;
use Illuminate\Http\Request;

class ExpenseService
{
    public function __construct(
        private readonly ExpenseRepositoryInterface $expenseRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function indexJsonPayload(string $projectId): array
    {
        $expenses = $this->expenseRepository->listByProject($projectId);
        $totalExpenses = (float) $expenses->sum('amount');
        $constructionContract = $this->expenseRepository->constructionContractForProject($projectId);

        return [
            'project_id' => (string) $projectId,
            'expenses' => $expenses,
            'total_expenses' => $totalExpenses,
            'remaining_income' => $constructionContract - $totalExpenses,
        ];
    }

    public function createExpense(string $projectId, array $validated): void
    {
        $this->expenseRepository->createExpense($projectId, $validated);
        $this->syncProjectFinancials($projectId);
    }

    public function updateExpense(Expense $expense, array $validated): void
    {
        $this->expenseRepository->updateExpense($expense, $validated);
        $this->syncProjectFinancials((string) $expense->project_id);
    }

    public function deleteExpense(Expense $expense): void
    {
        $projectId = (string) $expense->project_id;
        $this->expenseRepository->deleteExpense($expense);
        $this->syncProjectFinancials($projectId);
    }

    public function expenseTableQueryParams(Request $request): array
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
