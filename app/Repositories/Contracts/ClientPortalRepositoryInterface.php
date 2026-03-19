<?php

namespace App\Repositories\Contracts;

use App\Models\ProjectAssignment;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface ClientPortalRepositoryInterface
{
    public function latestClientAssignment(int $clientUserId): ?ProjectAssignment;

    public function summaryProjectByFamilyIds(array $familyProjectIds): ?object;

    public function designDownpaymentForProject(int $projectId): float;

    public function paginateProgressPhotos(array $projectIds, string $search, int $perPage): LengthAwarePaginator;

    public function paginateWeeklyAccomplishments(array $projectIds, string $search, int $perPage): LengthAwarePaginator;

    public function scopePhotosForProjectIds(array $projectIds): Collection;
}
