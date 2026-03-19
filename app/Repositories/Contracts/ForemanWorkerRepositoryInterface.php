<?php

namespace App\Repositories\Contracts;

use App\Models\Worker;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface ForemanWorkerRepositoryInterface
{
    public function paginateWorkersByForeman(int $foremanId, string $search, int $perPage): LengthAwarePaginator;

    public function createWorker(array $attributes): Worker;

    public function updateWorker(Worker $worker, array $attributes): void;

    public function deleteWorker(Worker $worker): void;

    public function updateAttendanceWorkerIdentity(
        int $foremanId,
        ?int $projectId,
        string $originalWorkerName,
        string $updatedWorkerName,
        string $updatedWorkerRole
    ): void;

    public function workerNameExists(int $foremanId, string $normalizedName, ?int $ignoreId = null): bool;

    public function assignedProjectIdsForForeman(int $foremanId): Collection;

    public function fallbackAssignedProjectIdsByName(string $foremanName): Collection;

    public function designPhaseIds(array $projectIds): Collection;
}
