<?php

namespace App\Repositories;

use App\Models\Attendance;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\Worker;
use App\Repositories\Contracts\ForemanWorkerRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class ForemanWorkerRepository implements ForemanWorkerRepositoryInterface
{
    public function paginateWorkersByForeman(int $foremanId, string $search, int $perPage): LengthAwarePaginator
    {
        $query = Worker::query()
            ->where('foreman_id', $foremanId)
            ->with('project:id,name');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('job_type', 'like', "%{$search}%")
                    ->orWhere('place_of_birth', 'like', "%{$search}%")
                    ->orWhere('sex', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('civil_status', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }

        return $query
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function createWorker(array $attributes): Worker
    {
        return Worker::query()->create($attributes);
    }

    public function updateWorker(Worker $worker, array $attributes): void
    {
        $worker->update($attributes);
    }

    public function deleteWorker(Worker $worker): void
    {
        $worker->delete();
    }

    public function updateAttendanceWorkerIdentity(
        int $foremanId,
        ?int $projectId,
        string $originalWorkerName,
        string $updatedWorkerName,
        string $updatedWorkerRole
    ): void {
        Attendance::query()
            ->where('foreman_id', $foremanId)
            ->when($projectId, fn ($query) => $query->where('project_id', $projectId))
            ->where('worker_name', $originalWorkerName)
            ->update([
                'worker_name' => $updatedWorkerName,
                'worker_role' => $updatedWorkerRole,
            ]);
    }

    public function workerNameExists(int $foremanId, string $normalizedName, ?int $ignoreId = null): bool
    {
        return Worker::query()
            ->where('foreman_id', $foremanId)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($normalizedName)])
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists();
    }

    public function assignedProjectIdsForForeman(int $foremanId): Collection
    {
        return ProjectAssignment::query()
            ->where('user_id', $foremanId)
            ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->pluck('project_id')
            ->map(fn ($projectId) => (int) $projectId)
            ->unique()
            ->values();
    }

    public function fallbackAssignedProjectIdsByName(string $foremanName): Collection
    {
        if (trim($foremanName) === '') {
            return collect();
        }

        return Project::query()
            ->whereNotNull('assigned')
            ->where('assigned', '!=', '')
            ->get(['id', 'assigned'])
            ->filter(function (Project $project) use ($foremanName) {
                $assignedNames = collect(preg_split('/[,;]+/', (string) $project->assigned))
                    ->map(fn ($part) => trim((string) $part))
                    ->filter();

                return $assignedNames->contains($foremanName);
            })
            ->pluck('id')
            ->map(fn ($projectId) => (int) $projectId)
            ->unique()
            ->values();
    }

    public function designPhaseIds(array $projectIds): Collection
    {
        if (empty($projectIds)) {
            return collect();
        }

        return Project::query()
            ->whereIn('id', $projectIds)
            ->whereRaw('LOWER(TRIM(phase)) = ?', [strtolower(Project::PHASE_DESIGN)])
            ->pluck('id')
            ->map(fn ($projectId) => (int) $projectId)
            ->values();
    }
}
