<?php

namespace App\Repositories\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface ProgressPhotoRepositoryInterface
{
    public function paginateNonDesignProjects(int $perPage): LengthAwarePaginator;

    public function paginatePhotoProjectIds(string $search, int $perPage): LengthAwarePaginator;

    public function listByProjectIds(array $projectIds, string $search): Collection;
}
