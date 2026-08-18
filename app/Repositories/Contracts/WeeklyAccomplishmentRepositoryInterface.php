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

    public function filterProjects(): Collection;

    public function filterForemen(): Collection;
}
