<?php

namespace App\Repositories\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface WeeklyAccomplishmentRepositoryInterface
{
    public function paginateNonDesignProjects(int $perPage): LengthAwarePaginator;

    public function listNonDesignProjects(): Collection;

    public function paginateWeeklyProjectIds(string $search, int $perPage, array $filters = []): LengthAwarePaginator;

    public function listWeeklyProjectIds(string $search, array $filters = []): array;

    public function listWeeklyAccomplishmentsByProjectIds(array $projectIds, string $search, array $filters = []): Collection;

    public function listScopePhotosByProjectIds(array $projectIds): Collection;

    /**
     * Returns scope_names that belong to each project id, keyed by project id.
     * Projects without rows in project_scopes fall back to the default scope list.
     *
     * @return array<int|string, array<int, string>>
     */
    public function listScopeNamesByProjectIds(array $projectIds): array;

    /**
     * For every (project, foreman) pair that already has weekly submissions, creates
     * missing weekly_accomplishments rows for every skipped week between the first
     * recorded week and the current week, cloning the most recent recorded week's scopes.
     */
    public function generateSkippedWeeksToCurrent(): void;

    public function filterProjects(): Collection;

    public function filterForemen(): Collection;
}
