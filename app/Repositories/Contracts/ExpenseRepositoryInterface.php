<?php

namespace App\Repositories\Contracts;

use App\Models\Expense;
use Illuminate\Support\Collection;

interface ExpenseRepositoryInterface
{
    public function listByProject(string $projectId): Collection;

    public function constructionContractForProject(string $projectId): float;

    public function createExpense(string $projectId, array $attributes): void;

    public function updateExpense(Expense $expense, array $attributes): void;

    public function deleteExpense(Expense $expense): void;
}
