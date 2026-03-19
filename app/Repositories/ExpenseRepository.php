<?php

namespace App\Repositories;

use App\Models\BuildProject;
use App\Models\Expense;
use App\Repositories\Contracts\ExpenseRepositoryInterface;
use Illuminate\Support\Collection;

class ExpenseRepository implements ExpenseRepositoryInterface
{
    public function listByProject(string $projectId): Collection
    {
        return Expense::query()
            ->where('project_id', $projectId)
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get();
    }

    public function constructionContractForProject(string $projectId): float
    {
        return (float) (BuildProject::query()
            ->where('project_id', $projectId)
            ->value('construction_contract') ?? 0);
    }

    public function createExpense(string $projectId, array $attributes): void
    {
        Expense::query()->create([
            'project_id' => $projectId,
            ...$attributes,
        ]);
    }

    public function updateExpense(Expense $expense, array $attributes): void
    {
        $expense->update($attributes);
    }

    public function deleteExpense(Expense $expense): void
    {
        $expense->delete();
    }
}
