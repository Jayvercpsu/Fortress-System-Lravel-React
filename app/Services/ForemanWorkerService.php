<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Models\Worker;
use App\Enums\ProjectStatus;
use App\Repositories\Contracts\ForemanWorkerRepositoryInterface;
use App\Support\ProjectSelection;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ForemanWorkerService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly ForemanWorkerRepositoryInterface $foremanWorkerRepository
    ) {
    }

    public function ensureForeman(User $user): void
    {
        abort_unless($user->role === User::ROLE_FOREMAN, 403);
    }

    public function indexPayload(Request $request): array
    {
        $foreman = $request->user();
        $this->ensureForeman($foreman);

        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        $assignedProjects = $this->foremanAssignedProjects($foreman);
        $paginator = $this->foremanWorkerRepository->paginateWorkersByForeman((int) $foreman->id, $search, $perPage);

        $workers = collect($paginator->items())->map(fn (Worker $worker) => [
            'id' => $worker->id,
            'name' => $worker->name,
            'job_type' => $worker->job_type,
            'project_id' => $worker->project_id,
            'project_name' => $worker->project?->name,
            'birth_date' => optional($worker->birth_date)?->toDateString(),
            'place_of_birth' => $worker->place_of_birth,
            'sex' => $worker->sex,
            'civil_status' => $worker->civil_status,
            'phone' => $worker->phone,
            'address' => $worker->address,
            'created_at' => optional($worker->created_at)?->toDateTimeString(),
        ])->values();

        return [
            'workers' => $workers,
            'assignedProjects' => $assignedProjects->values()->all(),
            'workerTable' => [
                'search' => $search,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }

    public function createWorker(User $foreman, array $validated): void
    {
        $this->ensureForeman($foreman);

        $allowedProjectIds = $this->foremanAssignedProjects($foreman)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $this->assertProjectAllowed((int) $validated['project_id'], $allowedProjectIds);
        $this->assertUniqueWorkerName((int) $foreman->id, (string) ($validated['name'] ?? ''));

        $this->foremanWorkerRepository->createWorker([
            'foreman_id' => $foreman->id,
            ...$validated,
        ]);
    }

    public function updateWorker(User $foreman, Worker $worker, array $validated): void
    {
        $this->ensureForeman($foreman);
        abort_unless((int) $worker->foreman_id === (int) $foreman->id, 403);

        $allowedProjectIds = $this->foremanAssignedProjects($foreman)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $this->assertProjectAllowed((int) $validated['project_id'], $allowedProjectIds);
        $this->assertUniqueWorkerName((int) $foreman->id, (string) ($validated['name'] ?? ''), (int) $worker->id);

        $originalName = (string) $worker->name;
        $this->foremanWorkerRepository->updateWorker($worker, $validated);

        $updatedName = (string) $worker->name;
        $updatedRole = trim((string) ($worker->job_type ?: Worker::JOB_TYPE_WORKER)) ?: Worker::JOB_TYPE_WORKER;
        $this->foremanWorkerRepository->updateAttendanceWorkerIdentity(
            (int) $foreman->id,
            $worker->project_id ? (int) $worker->project_id : null,
            $originalName,
            $updatedName,
            $updatedRole
        );
    }

    public function deleteWorker(User $foreman, Worker $worker): void
    {
        $this->ensureForeman($foreman);
        abort_unless((int) $worker->foreman_id === (int) $foreman->id, 403);

        $this->foremanWorkerRepository->deleteWorker($worker);
    }

    public function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function foremanAssignedProjects(User $foreman): Collection
    {
        $assignedProjectIds = $this->foremanAssignedProjectIds($foreman);
        if ($assignedProjectIds->isEmpty()) {
            return collect();
        }

        return ProjectSelection::actualOptionsForIds($assignedProjectIds->all())
            ->filter(function (array $project) {
                $phase = Str::lower(trim((string) ($project['phase'] ?? '')));
                if ($phase !== Str::lower(Project::PHASE_CONSTRUCTION)) {
                    return false;
                }

                $status = ProjectStatus::fromMixed((string) ($project['status'] ?? ''));
                return !in_array($status, [ProjectStatus::COMPLETED, ProjectStatus::CANCELLED], true);
            })
            ->values();
    }

    private function foremanAssignedProjectIds(User $foreman): Collection
    {
        $assigned = $this->foremanWorkerRepository->assignedProjectIdsForForeman((int) $foreman->id);

        if ($assigned->isNotEmpty()) {
            return $this->excludeDesignPhaseIds($assigned);
        }

        $fullname = trim((string) ($foreman->fullname ?? ''));
        if ($fullname === '') {
            return collect();
        }

        $fallback = $this->foremanWorkerRepository->fallbackAssignedProjectIdsByName($fullname);

        return $this->excludeDesignPhaseIds($fallback);
    }

    private function excludeDesignPhaseIds(Collection $projectIds): Collection
    {
        if ($projectIds->isEmpty()) {
            return $projectIds;
        }

        $designIds = $this->foremanWorkerRepository->designPhaseIds($projectIds->all());
        if ($designIds->isEmpty()) {
            return $projectIds;
        }

        return $projectIds
            ->reject(fn (int $projectId) => $designIds->contains($projectId))
            ->values();
    }

    private function assertProjectAllowed(int $projectId, array $allowedProjectIds): void
    {
        if (!in_array($projectId, $allowedProjectIds, true)) {
            throw ValidationException::withMessages([
                'project_id' => __('messages.foreman_workers.project_not_assigned'),
            ]);
        }
    }

    private function assertUniqueWorkerName(int $foremanId, string $name, ?int $ignoreId = null): void
    {
        $normalized = trim($name);
        if ($normalized === '') {
            return;
        }

        if ($this->foremanWorkerRepository->workerNameExists($foremanId, $normalized, $ignoreId)) {
            throw ValidationException::withMessages([
                'name' => __('messages.foreman_workers.name_exists'),
            ]);
        }
    }
}
