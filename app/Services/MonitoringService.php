<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\MonitoringRepositoryInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class MonitoringService
{
    public function __construct(
        private readonly MonitoringRepositoryInterface $monitoringRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function pageByRole(User $user): string
    {
        return in_array($user->role, [User::ROLE_HEAD_ADMIN, User::ROLE_MASTER_ADMIN], true)
            ? 'HeadAdmin/Monitoring/Show'
            : 'Admin/Monitoring/Show';
    }

    public function showPayload(Project $project): array
    {
        $pmUserId = ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->where('role_in_project', ProjectAssignment::ROLE_PROJECT_MANAGER)
            ->orderByDesc('id')
            ->value('user_id');
        $pmName = trim((string) (User::query()
            ->where('id', $pmUserId)
            ->where('role', User::ROLE_PROJECT_MANAGER)
            ->value('fullname') ?? ''));
        $pmName = $pmName !== '' ? $pmName : null;

        $scopes = $this->monitoringRepository->scopesWithPhotos($project)
            ->map(function (ProjectScope $scope) use ($pmName) {
                $foremanName = trim((string) ($scope->assigned_personnel ?? ''));

                return [
                    'id' => $scope->id,
                    'project_id' => $scope->project_id,
                    'scope_name' => $scope->scope_name,
                    'assigned_personnel' => $scope->assigned_personnel,
                    'progress_percent' => (int) $scope->progress_percent,
                    'status' => $scope->status,
                    'remarks' => $scope->remarks,
                    'contract_amount' => (float) ($scope->contract_amount ?? 0),
                    'weight_percent' => (float) ($scope->weight_percent ?? 0),
                    'start_date' => optional($scope->start_date)?->toDateString(),
                    'target_completion' => optional($scope->target_completion)?->toDateString(),
                    'updated_at' => optional($scope->updated_at)?->toDateTimeString(),
                    'photos' => $scope->photos->map(function ($photo) use ($pmName, $foremanName) {
                        $attribution = \App\Support\ScopePhotoAttribution::resolve(
                            $photo->submitter,
                            $photo->caption,
                            $pmName,
                            $foremanName !== '' ? $foremanName : null
                        );

                        return [
                            'id' => $photo->id,
                            'photo_path' => $photo->photo_path,
                            'caption' => $photo->caption,
                            'created_at' => optional($photo->created_at)?->toDateTimeString(),
                            'submitted_by_name' => $attribution['name'],
                            'submitted_by_type' => $attribution['type'],
                        ];
                    })->values(),
                ];
            })
            ->values();

        return [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'overall_progress' => (int) $project->overall_progress,
                'status' => $project->status,
            ],
            'scopes' => $scopes,
            'foreman_options' => $this->projectForemanOptions($project),
        ];
    }

    public function createScope(Project $project, array $validated, ?int $authorId = null): void
    {
        $this->validateAssignedPersonnel($project, $validated);
        $this->assertWeightTotalWithinLimit($project, (float) ($validated['weight_percent'] ?? 0));
        if (Schema::hasColumn('project_scopes', 'sort_order')) {
            $validated['sort_order'] = $this->monitoringRepository->nextScopeSortOrder($project);
        } else {
            unset($validated['sort_order']);
        }
        // A starting PM progress links to the PM side too, so the new scope
        // immediately reflects across the PM web/mobile grids. The plan
        // (foreman) progress never creates PM rows by itself.
        $pmStart = array_key_exists('pm_progress_percent', $validated) && $validated['pm_progress_percent'] !== null
            ? round(max(0, min(100, (float) $validated['pm_progress_percent'])), 2)
            : null;
        unset($validated['pm_progress_percent']);

        $this->monitoringRepository->createScope($project, $validated);

        if ($pmStart !== null && $pmStart > 0 && $authorId !== null && $authorId > 0) {
            $this->recordPmProgress(
                (int) $project->id,
                trim((string) ($validated['scope_name'] ?? '')),
                $pmStart,
                $authorId
            );
        }

        // The plan (foreman) progress must also seed the foreman side, so a
        // scope created with e.g. 30% immediately opens on 30% in the foreman
        // jotform and mobile grids. Without this, new scopes render at 0%
        // until the next plan edit that changes the percent.
        $initialScopeName = trim((string) ($validated['scope_name'] ?? ''));
        if ($initialScopeName !== '') {
            $this->monitoringRepository->propagateScopeProgressToLatestWeekly(
                (int) $project->id,
                $initialScopeName,
                $initialScopeName,
                (float) ($validated['progress_percent'] ?? 0),
                (string) ($validated['assigned_personnel'] ?? '')
            );
        }

        $this->recomputeOverallProgress($project);
    }

    public function updateScope(ProjectScope $scope, array $validated, ?int $authorId = null): void
    {
        $previousScopeName = (string) ($scope->scope_name ?? '');
        $previousPercent = (float) ($scope->progress_percent ?? 0);

        // Dual progress: progress_percent drives the plan + foreman side
        // (propagated into foreman-side latest rows only — PM rows are never
        // touched here), while pm_progress_percent (build page) files the
        // PM side, linking the modal with the PM web/mobile grids.
        $pmPercent = array_key_exists('pm_progress_percent', $validated) && $validated['pm_progress_percent'] !== null
            ? (float) $validated['pm_progress_percent']
            : null;
        unset($validated['pm_progress_percent']);

        $this->validateAssignedPersonnel($scope->project, $validated);
        if (array_key_exists('weight_percent', $validated)) {
            $this->assertWeightTotalWithinLimit($scope->project, (float) $validated['weight_percent'], (int) $scope->id);
        }
        $this->monitoringRepository->updateScope($scope, $validated);

        if ($pmPercent !== null && $authorId !== null && $authorId > 0) {
            $this->recordPmProgress(
                (int) $scope->project_id,
                (string) ($scope->refresh()->scope_name ?? $previousScopeName),
                round(max(0, min(100, $pmPercent)), 2),
                $authorId
            );
        }

        // The plan percent stays authoritative for the foreman side: when it
        // or the scope name actually changed, push it down into the
        // foreman-side latest-week submission rows (in place — no new
        // history rows, submitter attribution untouched) so the foreman
        // jotform and mobile open on the edited value. PM rows only ever
        // follow renames — their percents are never touched here.
        $newPercent = (float) ($scope->progress_percent ?? 0);
        $newScopeName = (string) ($scope->scope_name ?? '');
        $planChanged = abs($newPercent - $previousPercent) > 0.0001 || $newScopeName !== $previousScopeName;
        if ($planChanged) {
            $this->monitoringRepository->propagateScopeProgressToLatestWeekly(
                (int) $scope->project_id,
                $previousScopeName,
                $newScopeName,
                $newPercent,
                (string) ($scope->assigned_personnel ?? '')
            );
        } elseif (trim($newScopeName) !== '' && ! $this->monitoringRepository->hasWeeklyRowsForScope((int) $scope->project_id, $newScopeName)) {
            // Plan unchanged (e.g. remarks-only edit, or a scope created
            // before foreman seeding existed): still ensure the foreman side
            // has a placeholder so the jotform/mobile open on the plan value
            // instead of 0%.
            $this->monitoringRepository->propagateScopeProgressToLatestWeekly(
                (int) $scope->project_id,
                $newScopeName,
                $newScopeName,
                $newPercent,
                (string) ($scope->assigned_personnel ?? '')
            );
        }

        $this->recomputeOverallProgress($scope->project);
    }

    /**
     * The combined Weight % of every scope on the project may never exceed
     * 100 — otherwise neither create nor update proceeds.
     */
    private function assertWeightTotalWithinLimit(Project $project, float $newWeight, ?int $ignoreScopeId = null): void
    {
        $existing = (float) ProjectScope::query()
            ->where('project_id', $project->id)
            ->when($ignoreScopeId !== null, fn ($query) => $query->where('id', '!=', $ignoreScopeId))
            ->sum('weight_percent');

        if ($existing + $newWeight > 100.0001) {
            throw ValidationException::withMessages([
                'weight_percent' => __('messages.monitoring.weight_total_exceeded', [
                    'total' => rtrim(rtrim(number_format($existing + $newWeight, 2), '0'), '.'),
                ]),
            ]);
        }
    }

    /**
     * Append-only PM-side progress row (foreman_id NULL), mirroring the PM
     * accomplishment grid dedup: no new row when the latest PM percent is
     * already identical.
     */
    private function recordPmProgress(int $projectId, string $scopeName, float $percent, int $authorId): void
    {
        $scopeName = trim($scopeName);
        if ($projectId <= 0 || $scopeName === '') {
            return;
        }

        $weekStart = Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();

        $latest = WeeklyAccomplishment::query()
            ->where('project_id', $projectId)
            ->whereNull('foreman_id')
            ->where('is_placeholder', false)
            ->whereRaw('LOWER(TRIM(scope_of_work)) = ?', [strtolower($scopeName)])
            ->orderByDesc('id')
            ->value('percent_completed');

        if ($latest !== null && round((float) $latest, 2) === round($percent, 2)) {
            return;
        }

        // Attribute to the assigned PM so the row surfaces in that PM's
        // grids (web + mobile filter by submitter); fall back to the author
        // when the project has no PM assigned yet.
        $submitterId = $this->assignedPmId($projectId) ?? $authorId;

        WeeklyAccomplishment::create([
            'foreman_id' => null,
            'submitted_by' => $submitterId,
            'project_id' => $projectId,
            'scope_of_work' => $scopeName,
            'percent_completed' => $percent,
            'week_start' => $weekStart,
            'is_placeholder' => false,
        ]);
    }

    private function assignedPmId(int $projectId): ?int
    {
        $userId = ProjectAssignment::query()
            ->where('project_id', $projectId)
            ->where('role_in_project', ProjectAssignment::ROLE_PROJECT_MANAGER)
            ->orderByDesc('id')
            ->value('user_id');

        if ($userId === null) {
            return null;
        }

        $isPm = User::query()
            ->where('id', $userId)
            ->where('role', User::ROLE_PROJECT_MANAGER)
            ->exists();

        return $isPm ? (int) $userId : null;
    }

    public function deleteScope(ProjectScope $scope): void
    {
        $project = $scope->project;
        $scopeName = (string) ($scope->scope_name ?? '');
        $this->monitoringRepository->deleteScope($scope);
        $this->deleteWeeklyRowsForScope((int) $scope->project_id, $scopeName);
        $this->recomputeOverallProgress($project);
    }

    public function deleteScopes(Project $project, array $ids): int
    {
        $scopes = ProjectScope::query()
            ->where('project_id', $project->id)
            ->whereIn('id', $ids)
            ->get();

        foreach ($scopes as $scope) {
            $scopeName = (string) ($scope->scope_name ?? '');
            $this->monitoringRepository->deleteScope($scope);
            $this->deleteWeeklyRowsForScope((int) $project->id, $scopeName);
        }

        $this->recomputeOverallProgress($project);

        return $scopes->count();
    }

    /**
     * A deleted scope must vanish from every progress grid — otherwise its
     * orphaned rows keep rendering as manual entries on PM web/mobile and
     * the foreman jotform (e.g. as "Assigned to another foreman").
     */
    private function deleteWeeklyRowsForScope(int $projectId, string $scopeName): void
    {
        $scopeName = trim($scopeName);
        if ($projectId <= 0 || $scopeName === '') {
            return;
        }

        WeeklyAccomplishment::query()
            ->where('project_id', $projectId)
            ->whereRaw('LOWER(TRIM(scope_of_work)) = ?', [strtolower($scopeName)])
            ->delete();
    }

    public function reorderScopes(Project $project, array $orderedIds): void
    {
        $this->monitoringRepository->reorderScopes($project, $orderedIds);
    }

    private function validateAssignedPersonnel(Project $project, array &$validated): void
    {
        $name = trim((string) ($validated['assigned_personnel'] ?? ''));
        $validated['assigned_personnel'] = $name !== '' ? $name : null;

        if ($name === '') {
            return;
        }

        $allowedNames = collect($this->projectForemanOptions($project))
            ->pluck('fullname')
            ->map(fn ($fullName) => trim((string) $fullName))
            ->filter()
            ->values()
            ->all();

        if (!in_array($name, $allowedNames, true)) {
            throw ValidationException::withMessages([
                'assigned_personnel' => __('messages.monitoring.assigned_personnel_invalid'),
            ]);
        }
    }

    private function recomputeOverallProgress(Project $project): void
    {
        // Overall progress follows the project_scopes table — the build page
        // owns scope progress. Weekly accomplishment rows are submission
        // records (foreman / project manager) and are never written from here.
        $averageProgress = $this->monitoringRepository->averageScopeProgress($project);

        $overallProgress = (int) round(max(0, min(100, $averageProgress)));
        $this->monitoringRepository->saveProjectOverallProgress($project, $overallProgress);
    }

    private function projectForemanOptions(Project $project): array
    {
        $assignedForemanIds = $this->monitoringRepository->assignedForemanIdsForProject((int) $project->id);

        $assignedForemen = $this->normalizeForemen(
            $this->monitoringRepository->foremenByIds($assignedForemanIds->all())
        );
        if ($assignedForemen->isNotEmpty()) {
            return $assignedForemen->all();
        }

        $legacyAssignedNames = collect(preg_split('/[,;]+/', (string) ($project->assigned ?? '')))
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->unique(fn (string $name) => Str::lower($name))
            ->values();

        if ($legacyAssignedNames->isNotEmpty()) {
            $legacyForemen = $this->normalizeForemen(
                $this->monitoringRepository->allForemen()
                    ->filter(fn (User $user) => $legacyAssignedNames->contains((string) $user->fullname))
            );

            if ($legacyForemen->isNotEmpty()) {
                return $legacyForemen->all();
            }
        }

        return $this->normalizeForemen($this->monitoringRepository->allForemen())->all();
    }

    private function normalizeForemen($users)
    {
        return collect($users)
            ->map(fn (User $user) => [
                'id' => (int) $user->id,
                'fullname' => trim((string) ($user->fullname ?? '')),
            ])
            ->filter(fn (array $row) => $row['fullname'] !== '')
            ->values();
    }
}
