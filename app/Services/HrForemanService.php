<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Support\Projects\ProjectFlow;

class HrForemanService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

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

        $query = User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->with('detail');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('fullname', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $paginator = $query
            ->orderBy('fullname')
            ->paginate($perPage)
            ->withQueryString();

        $pageForemen = collect($paginator->items());
        $foremanIds = $pageForemen
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->values();

        [$projectOptions, $selectedIdByProjectId] = $this->projectOptionsPayload();

        $assignedProjectIdsByForeman = [];
        if ($foremanIds->isNotEmpty()) {
            $assignedRows = ProjectAssignment::query()
                ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
                ->whereIn('user_id', $foremanIds->all())
                ->get(['user_id', 'project_id']);

            $assignedProjectIdsByForeman = $assignedRows
                ->groupBy('user_id')
                ->map(function ($rows) use ($selectedIdByProjectId) {
                    return $rows
                        ->map(fn ($row) => $selectedIdByProjectId[(int) $row->project_id] ?? (int) $row->project_id)
                        ->filter(fn ($id) => (int) $id > 0)
                        ->unique()
                        ->values()
                        ->all();
                })
                ->all();
        }

        $projectLabelsById = collect($projectOptions)
            ->mapWithKeys(fn (array $option) => [(int) $option['id'] => (string) ($option['label'] ?? $option['name'] ?? '')])
            ->all();
        $allowedProjectIds = array_fill_keys(array_keys($projectLabelsById), true);

        if ($allowedProjectIds !== []) {
            $assignedProjectIdsByForeman = collect($assignedProjectIdsByForeman)
                ->map(function (array $ids) use ($allowedProjectIds) {
                    return collect($ids)
                        ->filter(fn ($id) => isset($allowedProjectIds[(int) $id]))
                        ->values()
                        ->all();
                })
                ->all();
        }

        $foremen = $pageForemen->map(function (User $foreman) use ($assignedProjectIdsByForeman, $projectLabelsById) {
            $assignedIds = $assignedProjectIdsByForeman[$foreman->id] ?? [];
            $projectNames = collect($assignedIds)
                ->map(fn ($id) => $projectLabelsById[(int) $id] ?? null)
                ->filter(fn ($name) => $name !== null && $name !== '')
                ->values()
                ->all();

            return [
                'id' => $foreman->id,
                'fullname' => $foreman->fullname,
                'email' => $foreman->email,
                'phone' => $foreman->detail?->phone,
                'assigned_project_ids' => $assignedIds,
                'project_names' => $projectNames,
                'created_at' => optional($foreman->created_at)?->toDateTimeString(),
            ];
        })->values();

        return [
            'foremen' => $foremen,
            'projectOptions' => $projectOptions,
            'assignedProjectIdsByForeman' => $assignedProjectIdsByForeman,
            'foremanTable' => [
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

    public function createForeman(User $user, array $validated): void
    {
        $this->ensureAuthorized($user);

        $foreman = User::query()->create([
            'fullname' => $validated['fullname'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => User::ROLE_FOREMAN,
        ]);

        $foreman->detail()->updateOrCreate(
            ['user_id' => $foreman->id],
            [
                'phone' => $validated['phone'] ?? null,
            ]
        );

        $this->syncForemanAssignments($foreman->id, $validated['project_ids'] ?? []);
    }

    public function updateForeman(User $user, User $foreman, array $validated): void
    {
        $this->ensureAuthorized($user);

        $payload = [
            'fullname' => $validated['fullname'],
            'email' => $validated['email'],
        ];

        if (!empty($validated['password'])) {
            $payload['password'] = Hash::make($validated['password']);
        }

        $foreman->update($payload);

        $foreman->detail()->updateOrCreate(
            ['user_id' => $foreman->id],
            [
                'phone' => $validated['phone'] ?? null,
            ]
        );

        $this->syncForemanAssignments($foreman->id, $validated['project_ids'] ?? []);
    }

    public function deleteForeman(User $user, User $foreman): void
    {
        $this->ensureAuthorized($user);

        ProjectAssignment::query()
            ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->where('user_id', $foreman->id)
            ->delete();

        $foreman->delete();
    }

    private function syncForemanAssignments(int $foremanId, array $projectIds): void
    {
        $ids = collect($projectIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        ProjectAssignment::query()
            ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->where('user_id', $foremanId)
            ->whereNotIn('project_id', $ids->all())
            ->delete();

        if ($ids->isEmpty()) {
            return;
        }

        foreach ($ids as $projectId) {
            $assignment = ProjectAssignment::query()
                ->withTrashed()
                ->firstOrNew([
                    'project_id' => $projectId,
                    'user_id' => $foremanId,
                ]);

            $assignment->role_in_project = ProjectAssignment::ROLE_FOREMAN;
            if ($assignment->deleted_at !== null) {
                $assignment->deleted_at = null;
            }

            $assignment->save();
        }
    }

    private function projectOptionsPayload(): array
    {
        $projects = Project::query()
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id', 'source_project_id', 'name', 'phase', 'status', 'updated_at']);

        $projectOptions = [];
        $selectedIdByProjectId = [];

        $projects
            ->groupBy(fn (Project $project) => (int) ($project->source_project_id ?: $project->id))
            ->each(function ($family) use (&$projectOptions, &$selectedIdByProjectId) {
                if ($family->isEmpty()) {
                    return;
                }

                $eligible = $family->filter(function (Project $project) {
                    $phase = ProjectFlow::normalizePhase($project->phase);
                    if ($phase === Project::PHASE_COMPLETED) {
                        return false;
                    }

                    $status = ProjectFlow::normalizeStatus($project->status);
                    return !in_array($status, [ProjectStatus::COMPLETED->value, ProjectStatus::CANCELLED->value], true);
                });

                if ($eligible->isEmpty()) {
                    return;
                }

                $selected = $eligible
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

                $eligible->each(function (Project $project) use (&$selectedIdByProjectId, $selected) {
                    $selectedIdByProjectId[(int) $project->id] = (int) $selected->id;
                });
            });

        $projectOptions = collect($projectOptions)
            ->sortBy(fn (array $option) => mb_strtolower((string) ($option['name'] ?? '')))
            ->values()
            ->all();

        return [$projectOptions, $selectedIdByProjectId];
    }
}
