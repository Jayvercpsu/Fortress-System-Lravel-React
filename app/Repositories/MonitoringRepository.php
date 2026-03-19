<?php

namespace App\Repositories;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\MonitoringRepositoryInterface;
use Illuminate\Support\Collection;

class MonitoringRepository implements MonitoringRepositoryInterface
{
    public function scopesWithPhotos(Project $project): Collection
    {
        return $project->scopes()
            ->with(['photos' => fn ($query) => $query->latest('id')])
            ->latest('id')
            ->get();
    }

    public function createScope(Project $project, array $attributes): void
    {
        $project->scopes()->create($attributes);
    }

    public function updateScope(ProjectScope $scope, array $attributes): void
    {
        $scope->update($attributes);
    }

    public function deleteScope(ProjectScope $scope): void
    {
        $scope->delete();
    }

    public function latestWeeklyWeekStart(int $projectId): ?string
    {
        return WeeklyAccomplishment::query()
            ->where('project_id', $projectId)
            ->max('week_start');
    }

    public function averageWeeklyProgress(int $projectId, string $weekStart): float
    {
        return (float) (WeeklyAccomplishment::query()
            ->where('project_id', $projectId)
            ->whereDate('week_start', $weekStart)
            ->avg('percent_completed') ?? 0);
    }

    public function averageScopeProgress(Project $project): float
    {
        return (float) ($project->scopes()->avg('progress_percent') ?? 0);
    }

    public function saveProjectOverallProgress(Project $project, int $overallProgress): void
    {
        $project->overall_progress = $overallProgress;
        $project->save();
    }

    public function assignedForemanIdsForProject(int $projectId): Collection
    {
        return ProjectAssignment::query()
            ->where('project_id', $projectId)
            ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    public function foremenByIds(array $ids): Collection
    {
        if (empty($ids)) {
            return collect();
        }

        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->whereIn('id', $ids)
            ->orderBy('fullname')
            ->get(['id', 'fullname']);
    }

    public function allForemen(): Collection
    {
        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname']);
    }
}
