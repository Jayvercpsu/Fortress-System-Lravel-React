<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\User;
use App\Repositories\Contracts\MonitoringRepositoryInterface;
use Illuminate\Support\Str;
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
        return $user->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Monitoring/Show'
            : 'Admin/Monitoring/Show';
    }

    public function showPayload(Project $project): array
    {
        $scopes = $this->monitoringRepository->scopesWithPhotos($project)
            ->map(fn (ProjectScope $scope) => [
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
                'photos' => $scope->photos->map(fn ($photo) => [
                    'id' => $photo->id,
                    'photo_path' => $photo->photo_path,
                    'caption' => $photo->caption,
                    'created_at' => optional($photo->created_at)?->toDateTimeString(),
                ])->values(),
            ])
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

    public function createScope(Project $project, array $validated): void
    {
        $this->validateAssignedPersonnel($project, $validated);
        $this->monitoringRepository->createScope($project, $validated);
        $this->recomputeOverallProgress($project);
    }

    public function updateScope(ProjectScope $scope, array $validated): void
    {
        $this->validateAssignedPersonnel($scope->project, $validated);
        $this->monitoringRepository->updateScope($scope, $validated);
        $this->recomputeOverallProgress($scope->project);
    }

    public function deleteScope(ProjectScope $scope): void
    {
        $project = $scope->project;
        $this->monitoringRepository->deleteScope($scope);
        $this->recomputeOverallProgress($project);
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
        $latestWeekStart = $this->monitoringRepository->latestWeeklyWeekStart((int) $project->id);

        if ($latestWeekStart) {
            $averageProgress = $this->monitoringRepository->averageWeeklyProgress((int) $project->id, $latestWeekStart);
        } else {
            $averageProgress = $this->monitoringRepository->averageScopeProgress($project);
        }

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
