<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use App\Models\Worker;
use App\Repositories\Contracts\ForemanWorkerRepositoryInterface;
use App\Support\Projects\ProjectFlow;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class HrWorkerService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly ForemanWorkerRepositoryInterface $foremanWorkerRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, [User::ROLE_HR, User::ROLE_HEAD_ADMIN], true), 403);
    }

    public function indexPayload(Request $request): array
    {
        $this->ensureAuthorized($request->user());

        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        $foremanId = (int) $request->query('foreman_id', 0);
        $projectId = (int) $request->query('project_id', 0);

        $query = Worker::query()
            ->with(['project:id,name', 'foreman:id,fullname']);

        if ($foremanId > 0) {
            $query->where('foreman_id', $foremanId);
        }

        if ($projectId > 0) {
            $query->where('project_id', $projectId);
        }

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('job_type', 'like', "%{$search}%")
                    ->orWhere('place_of_birth', 'like', "%{$search}%")
                    ->orWhere('sex', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('civil_status', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%")
                    ->orWhereHas('project', fn ($project) => $project->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('foreman', fn ($foreman) => $foreman->where('fullname', 'like', "%{$search}%"));
            });
        }

        $paginator = $query
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        $workers = collect($paginator->items())->map(fn (Worker $worker) => [
            'id' => $worker->id,
            'name' => $worker->name,
            'job_type' => $worker->job_type,
            'project_id' => $worker->project_id,
            'project_name' => $worker->project?->name,
            'foreman_id' => $worker->foreman_id,
            'foreman_name' => $worker->foreman?->fullname,
            'birth_date' => optional($worker->birth_date)?->toDateString(),
            'place_of_birth' => $worker->place_of_birth,
            'sex' => $worker->sex,
            'civil_status' => $worker->civil_status,
            'phone' => $worker->phone,
            'address' => $worker->address,
            'created_at' => optional($worker->created_at)?->toDateTimeString(),
        ])->values();

        $foremanOptions = User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $foreman) => [
                'id' => (int) $foreman->id,
                'name' => (string) $foreman->fullname,
            ])
            ->values()
            ->all();

        $projects = Project::query()
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id', 'source_project_id', 'name', 'phase', 'status', 'updated_at']);

        $projectOptions = [];
        $familyProjectIdsBySelectedId = [];

        $projects
            ->groupBy(fn (Project $project) => (int) ($project->source_project_id ?: $project->id))
            ->each(function ($family) use (&$projectOptions, &$familyProjectIdsBySelectedId) {
                if ($family->isEmpty()) {
                    return;
                }

                $selected = $family
                    ->sortByDesc(function (Project $project) {
                        $phaseRank = match (ProjectFlow::normalizePhase($project->phase)) {
                            Project::PHASE_COMPLETED => 3,
                            Project::PHASE_CONSTRUCTION => 2,
                            default => 1,
                        };
                        $updatedAt = optional($project->updated_at)?->timestamp ?? 0;
                        return ($phaseRank * 1_000_000_000) + $updatedAt;
                    })
                    ->first();

                if (!$selected) {
                    return;
                }

                $projectOptions[] = [
                    'id' => (int) $selected->id,
                    'name' => (string) $selected->name,
                    'label' => (string) $selected->name,
                ];

                $familyProjectIdsBySelectedId[(string) $selected->id] = $family
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values()
                    ->all();
            });

        $projectOptions = collect($projectOptions)
            ->sortBy(fn (array $option) => mb_strtolower((string) ($option['name'] ?? '')))
            ->values()
            ->all();

        $familyProjectIds = collect($familyProjectIdsBySelectedId)
            ->flatten()
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        $foremanAssignments = [];
        if ($familyProjectIds->isNotEmpty()) {
            $assignedByProjectId = ProjectAssignment::query()
                ->whereIn('project_id', $familyProjectIds->all())
                ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
                ->get(['project_id', 'user_id'])
                ->groupBy('project_id')
                ->map(fn ($rows) => $rows->pluck('user_id')
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values()
                    ->all()
                );

            foreach ($familyProjectIdsBySelectedId as $selectedId => $familyIds) {
                $foremanIds = collect($familyIds)
                    ->flatMap(fn ($id) => $assignedByProjectId->get($id, []))
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values()
                    ->all();

                $foremanAssignments[(string) $selectedId] = $foremanIds;
            }
        }

        return [
            'workers' => $workers,
            'foremanOptions' => $foremanOptions,
            'projectOptions' => $projectOptions,
            'foremanAssignments' => $foremanAssignments,
            'filters' => [
                'foreman_id' => $foremanId > 0 ? $foremanId : null,
                'project_id' => $projectId > 0 ? $projectId : null,
            ],
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

    public function createWorker(User $user, array $validated): void
    {
        $this->ensureAuthorized($user);

        $foremanId = (int) ($validated['foreman_id'] ?? 0);
        $this->assertUniqueWorkerName($foremanId, (string) ($validated['name'] ?? ''));

        $this->foremanWorkerRepository->createWorker($validated);
    }

    public function updateWorker(User $user, Worker $worker, array $validated): void
    {
        $this->ensureAuthorized($user);

        $foremanId = (int) ($validated['foreman_id'] ?? $worker->foreman_id);
        $this->assertUniqueWorkerName($foremanId, (string) ($validated['name'] ?? ''), (int) $worker->id);

        $originalName = (string) $worker->name;
        $originalForemanId = (int) $worker->foreman_id;
        $originalProjectId = $worker->project_id ? (int) $worker->project_id : null;

        $this->foremanWorkerRepository->updateWorker($worker, $validated);

        $updatedName = (string) $worker->name;
        $updatedRole = trim((string) ($worker->job_type ?: Worker::JOB_TYPE_WORKER)) ?: Worker::JOB_TYPE_WORKER;

        if ($originalName !== $updatedName || $originalProjectId !== ($worker->project_id ? (int) $worker->project_id : null)) {
            $this->foremanWorkerRepository->updateAttendanceWorkerIdentity(
                $originalForemanId,
                $originalProjectId,
                $originalName,
                $updatedName,
                $updatedRole
            );
        }
    }

    public function deleteWorker(User $user, Worker $worker): void
    {
        $this->ensureAuthorized($user);

        $this->foremanWorkerRepository->deleteWorker($worker);
    }

    public function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
            'foreman_id' => $request->query('foreman_id'),
            'project_id' => $request->query('project_id'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function assertUniqueWorkerName(int $foremanId, string $name, ?int $ignoreId = null): void
    {
        $normalized = trim($name);
        if ($normalized === '' || $foremanId <= 0) {
            return;
        }

        if ($this->foremanWorkerRepository->workerNameExists($foremanId, $normalized, $ignoreId)) {
            throw ValidationException::withMessages([
                'name' => __('messages.foreman_workers.name_exists'),
            ]);
        }
    }
}
