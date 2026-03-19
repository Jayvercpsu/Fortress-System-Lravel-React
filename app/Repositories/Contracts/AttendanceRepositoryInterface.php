<?php

namespace App\Repositories\Contracts;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface AttendanceRepositoryInterface
{
    public function paginateAttendances(
        array $filters,
        string $search,
        array $projectFamilyIds,
        int $perPage
    ): LengthAwarePaginator;

    public function paginateAttendanceSummary(
        array $filters,
        string $search,
        array $projectFamilyIds,
        int $perPage
    ): LengthAwarePaginator;

    public function attendanceSummaryTotals(array $filters, string $search, array $projectFamilyIds): array;

    public function foremanOptions(): Collection;

    public function workerRoleOptions(): Collection;
}
