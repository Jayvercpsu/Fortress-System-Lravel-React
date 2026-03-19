<?php

namespace App\Repositories\Contracts;

use App\Models\BuildProject;
use App\Models\Project;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface BuildRepositoryInterface
{
    public function findProjectOrFail(string $projectId): Project;

    public function firstOrCreateBuildByProjectId(string $projectId): BuildProject;

    public function expenseTotal(string $projectId): float;

    public function expenseCategoryTotals(string $projectId): Collection;

    public function materialOptions(): array;

    public function paginatedExpenses(string $projectId, string $search, int $perPage): LengthAwarePaginator;

    public function scopesWithPhotos(Project $project): Collection;

    public function insertDefaultScopes(Project $project, array $scopeNames): void;

    public function projectForemanOptions(Project $project): array;

    public function updateOrCreateBuildByProjectId(string $projectId, array $attributes): void;

    public function findBuildByProjectId(string $projectId): ?BuildProject;
}
