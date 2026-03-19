<?php

namespace App\Repositories\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface DeliveryConfirmationRepositoryInterface
{
    public function paginateNonDesignProjects(int $perPage): LengthAwarePaginator;

    public function paginateDeliveryProjectIds(string $search, string $status, int $perPage): LengthAwarePaginator;

    public function listByProjectIds(array $projectIds, string $search, string $status): Collection;
}
