<?php

namespace App\Repositories;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\MonitoringRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class MonitoringRepository implements MonitoringRepositoryInterface
{
    public function scopesWithPhotos(Project $project): Collection
    {
        $query = $project->scopes()
            ->with(['photos' => fn ($query) => $query->latest('id')]);

        if (Schema::hasColumn('project_scopes', 'sort_order')) {
            $query->orderByRaw('sort_order is null')
                ->orderBy('sort_order')
                ->orderBy('id');
        } else {
            $query->orderBy('id');
        }

        return $query->get();
    }

    public function nextScopeSortOrder(Project $project): int
    {
        if (!Schema::hasColumn('project_scopes', 'sort_order')) {
            $maxId = ProjectScope::query()
                ->where('project_id', $project->id)
                ->max('id');

            return (int) ($maxId ?? 0) + 1;
        }

        $maxSortOrder = ProjectScope::query()
            ->where('project_id', $project->id)
            ->max('sort_order');

        if ($maxSortOrder === null) {
            $maxSortOrder = ProjectScope::query()
                ->where('project_id', $project->id)
                ->max('id');
        }

        return (int) ($maxSortOrder ?? 0) + 1;
    }

    public function reorderScopes(Project $project, array $orderedIds): void
    {
        if (!Schema::hasColumn('project_scopes', 'sort_order')) {
            return;
        }

        $ordered = collect($orderedIds)
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->values();

        if ($ordered->isEmpty()) {
            return;
        }

        DB::transaction(function () use ($project, $ordered) {
            $existingIds = ProjectScope::query()
                ->where('project_id', $project->id)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values();

            $ordered = $ordered->intersect($existingIds)->values();
            $remaining = $existingIds->diff($ordered)->values();
            $position = 1;

            foreach ($ordered as $id) {
                ProjectScope::query()
                    ->where('project_id', $project->id)
                    ->where('id', $id)
                    ->update(['sort_order' => $position++]);
            }

            foreach ($remaining as $id) {
                ProjectScope::query()
                    ->where('project_id', $project->id)
                    ->where('id', $id)
                    ->update(['sort_order' => $position++]);
            }
        });
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
        $scope->photos()
            ->pluck('photo_path')
            ->map(fn ($path) => trim((string) $path))
            ->filter(fn (string $path) => $path !== '')
            ->unique()
            ->each(fn (string $path) => UploadManager::delete($path));

        $scope->delete();
    }

    public function averageScopeProgress(Project $project): float
    {
        return (float) ($project->scopes()->avg('progress_percent') ?? 0);
    }

    /**
     * Push a build-page scope edit down into submissions (in place). Only the
     * single latest real row per foreman for the scope is forced to the edited
     * value — older history rows keep their submitted percents. Unsubmitted
     * auto-seeded placeholders are brought in line as well, with their
     * timestamps pinned so they stay invisible on /weekly-accomplishments.
     * When the scope has no weekly rows at all, a placeholder is seeded for
     * the current week per assigned foreman so the grids open on the edited
     * value. No submission records are created and submitter attribution is
     * preserved. The foreman jotform and PM grids read the latest per scope,
     * so they open on the edited value.
     */
    public function propagateScopeProgressToLatestWeekly(int $projectId, string $previousScopeName, string $newScopeName, float $progressPercent, string $assignedPersonnel = ''): void
    {
        $previousScopeName = trim($previousScopeName);
        $newScopeName = trim($newScopeName);
        if ($projectId <= 0 || $previousScopeName === '' || $newScopeName === '') {
            return;
        }

        $scopeFilter = fn ($query) => $query
            ->where('project_id', $projectId)
            ->whereRaw('LOWER(scope_of_work) = ?', [Str::lower($previousScopeName)]);

        $latestIds = WeeklyAccomplishment::query()
            ->where($scopeFilter)
            ->where('is_placeholder', false)
            ->groupBy('foreman_id')
            ->pluck(DB::raw('MAX(id)'))
            ->filter()
            ->values()
            ->all();

        if (!empty($latestIds)) {
            WeeklyAccomplishment::query()
                ->whereIn('id', $latestIds)
                ->update([
                    'scope_of_work' => $newScopeName,
                    'percent_completed' => $progressPercent,
                ]);
        }

        WeeklyAccomplishment::query()
            ->where($scopeFilter)
            ->where('is_placeholder', true)
            ->update([
                'scope_of_work' => $newScopeName,
                'percent_completed' => $progressPercent,
                'updated_at' => DB::raw('created_at'),
            ]);

        if (!WeeklyAccomplishment::query()->where($scopeFilter)->exists()
            && !WeeklyAccomplishment::query()
                ->where('project_id', $projectId)
                ->whereRaw('LOWER(scope_of_work) = ?', [Str::lower($newScopeName)])
                ->exists()) {
            $this->seedScopePlaceholderForAssignedForemen($projectId, $newScopeName, $progressPercent, $assignedPersonnel);
        }
    }

    /**
     * Seed one current-week placeholder per assigned foreman so grids open on
     * the build-page value. Fresh rows get identical created/updated stamps
     * and stay unsubmitted, hence invisible on /weekly-accomplishments.
     */
    private function seedScopePlaceholderForAssignedForemen(int $projectId, string $scopeName, float $progressPercent, string $assignedPersonnel): void
    {
        $names = collect(preg_split('/[,;]+/', $assignedPersonnel))
            ->map(fn ($name) => Str::lower(trim((string) $name)))
            ->filter()
            ->values();

        $foremanIds = $this->assignedForemanIdsForProject($projectId);
        $candidates = $this->foremenByIds($foremanIds->all());
        if ($candidates->isEmpty()) {
            $candidates = $this->allForemen();
        }

        $matched = $candidates
            ->filter(fn (User $user) => $names->contains(Str::lower(trim((string) $user->fullname))))
            ->map(fn (User $user) => (int) $user->id)
            ->unique()
            ->values();

        $targetIds = $matched->isNotEmpty() ? $matched : $candidates->map(fn (User $user) => (int) $user->id)->unique()->values();
        if ($targetIds->isEmpty()) {
            return;
        }

        $weekStart = Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();
        foreach ($targetIds as $foremanId) {
            WeeklyAccomplishment::query()->create([
                'foreman_id' => $foremanId,
                'project_id' => $projectId,
                'scope_of_work' => $scopeName,
                'percent_completed' => $progressPercent,
                'week_start' => $weekStart,
                'is_placeholder' => true,
            ]);
        }
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
