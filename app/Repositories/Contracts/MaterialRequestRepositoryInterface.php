<?php

namespace App\Repositories\Contracts;

use App\Models\MaterialRequest;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface MaterialRequestRepositoryInterface
{
    public function paginateNonDesignProjects(int $perPage): LengthAwarePaginator;

    public function paginateMaterialRequestProjectIds(string $search, string $status, int $perPage): LengthAwarePaginator;

    public function listByProjectIds(array $projectIds, string $search, string $status): Collection;

    public function updateStatus(MaterialRequest $materialRequest, string $status): void;
}
