<?php

namespace App\Repositories;

use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\WeeklyAccomplishmentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class WeeklyAccomplishmentRepository implements WeeklyAccomplishmentRepositoryInterface
{
    public function paginateNonDesignProjects(int $perPage): LengthAwarePaginator
    {
        return Project::query()
            ->whereRaw('LOWER(TRIM(COALESCE(phase, \'\'))) != ?', [strtolower(Project::PHASE_DESIGN)])
            ->orderBy('name')
            ->orderBy('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function listNonDesignProjects(): Collection
    {
        return Project::query()
            ->whereRaw('LOWER(TRIM(COALESCE(phase, \'\'))) != ?', [strtolower(Project::PHASE_DESIGN)])
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id', 'name']);
    }

    public function paginateWeeklyProjectIds(string $search, int $perPage, array $filters = []): LengthAwarePaginator
    {
        $query = WeeklyAccomplishment::query();
        $this->applySearch($query, $search);
        $this->applyFilters($query, $filters);

        return (clone $query)
            ->selectRaw('project_id, MAX(updated_at) as last_updated_at')
            ->groupBy('project_id')
            ->orderByDesc('last_updated_at')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function listWeeklyProjectIds(string $search, array $filters = []): array
    {
        $query = WeeklyAccomplishment::query();
        $this->applySearch($query, $search);
        $this->applyFilters($query, $filters);

        return (clone $query)
            ->selectRaw('project_id')
            ->distinct()
            ->pluck('project_id')
            ->all();
    }

    public function listWeeklyAccomplishmentsByProjectIds(array $projectIds, string $search, array $filters = []): Collection
    {
        if (empty($projectIds)) {
            return collect();
        }

        $query = WeeklyAccomplishment::query()
            ->with('foreman:id,fullname', 'project:id,name');
        $this->applySearch($query, $search);
        $this->applyFilters($query, $filters);

        $nonNullProjectIds = array_values(array_filter($projectIds, fn ($value) => $value !== null));
        $hasNullProject = in_array(null, $projectIds, true);

        $query->where(function ($builder) use ($nonNullProjectIds, $hasNullProject) {
            if (!empty($nonNullProjectIds)) {
                $builder->whereIn('project_id', $nonNullProjectIds);
                if ($hasNullProject) {
                    $builder->orWhereNull('project_id');
                }
            } elseif ($hasNullProject) {
                $builder->whereNull('project_id');
            } else {
                $builder->whereRaw('0 = 1');
            }
        });

        return $query->latest('updated_at')->get();
    }

    public function listScopePhotosByProjectIds(array $projectIds): Collection
    {
        if (empty($projectIds)) {
            return collect();
        }

        return ScopePhoto::query()
            ->select([
                'scope_photos.id',
                'scope_photos.photo_path',
                'scope_photos.caption',
                'scope_photos.created_at',
                'project_scopes.scope_name',
            ])
            ->join('project_scopes', 'project_scopes.id', '=', 'scope_photos.project_scope_id')
            ->whereIn('project_scopes.project_id', $projectIds)
            ->orderByDesc('scope_photos.id')
            ->get();
    }

    public function listScopeNamesByProjectIds(array $projectIds): array
    {
        $nonNullProjectIds = array_values(array_filter($projectIds, fn ($value) => $value !== null));
        if (empty($nonNullProjectIds)) {
            return [];
        }

        $scopesByProject = ProjectScope::query()
            ->whereIn('project_id', $nonNullProjectIds)
            ->whereRaw("TRIM(COALESCE(scope_name, '')) != ?", [''])
            ->orderBy('project_id')
            ->orderBy('id')
            ->get(['project_id', 'scope_name'])
            ->groupBy('project_id');

        $map = [];
        foreach ($nonNullProjectIds as $projectId) {
            $names = $scopesByProject->get((int) $projectId)?->pluck('scope_name')->filter()->values()->all();
            $map[$projectId] = $names !== null && count($names) > 0
                ? $names
                : WeeklyAccomplishment::defaultScopeOfWorks();
        }

        return $map;
    }

    public function generateSkippedWeeksToCurrent(): void
    {
        $currentWeek = Carbon::now('Asia/Manila')
            ->startOfWeek(Carbon::MONDAY)
            ->toDateString();

        $combos = WeeklyAccomplishment::query()
            ->select('foreman_id', 'project_id')
            ->whereNotNull('foreman_id')
            ->whereNotNull('project_id')
            ->distinct()
            ->get();

        foreach ($combos as $combo) {
            $this->backfillComboToCurrent(
                (int) $combo->foreman_id,
                (int) $combo->project_id,
                $currentWeek
            );
        }
    }

    private function backfillComboToCurrent(int $foremanId, int $projectId, string $currentWeek): void
    {
        $recordedWeeks = WeeklyAccomplishment::query()
            ->where('foreman_id', $foremanId)
            ->where('project_id', $projectId)
            ->whereNotNull('week_start')
            ->orderBy('week_start')
            ->pluck('week_start')
            ->map(fn ($week) => Carbon::parse($week)
                ->startOfWeek(Carbon::MONDAY)
                ->toDateString())
            ->unique()
            ->values();

        if ($recordedWeeks->isEmpty()) {
            return;
        }

        $firstWeek = (string) $recordedWeeks->first();
        if ($firstWeek > $currentWeek) {
            return;
        }

        $knownWeeks = $recordedWeeks->flip();

        $cursor = Carbon::parse($firstWeek);
        $end = Carbon::parse($currentWeek);
        $sourceRows = [];

        while (!$cursor->gt($end)) {
            $week = $cursor->toDateString();

            if ($knownWeeks->has($week)) {
                $sourceRows = WeeklyAccomplishment::query()
                    ->where('foreman_id', $foremanId)
                    ->where('project_id', $projectId)
                    ->whereDate('week_start', $week)
                    ->orderBy('id')
                    ->get(['scope_of_work', 'percent_completed'])
                    ->map(fn (WeeklyAccomplishment $row) => [
                        'scope_of_work' => trim((string) $row->scope_of_work),
                        'percent_completed' => (float) ($row->percent_completed ?? 0),
                    ])
                    ->filter(fn (array $row) => $row['scope_of_work'] !== '')
                    ->values()
                    ->all();
            } elseif ($sourceRows !== []) {
                foreach ($sourceRows as $row) {
                    WeeklyAccomplishment::query()->updateOrCreate(
                        [
                            'foreman_id' => $foremanId,
                            'project_id' => $projectId,
                            'week_start' => $week,
                            'scope_of_work' => $row['scope_of_work'],
                        ],
                        [
                            'percent_completed' => $row['percent_completed'],
                            'is_placeholder' => true,
                        ]
                    );
                }
            }

            $cursor->addDay(7);
        }
    }

    private function applySearch(Builder $builder, string $search): void
    {
        if ($search === '') {
            return;
        }

        $builder->where(function ($query) use ($search) {
            $query->where('scope_of_work', 'like', "%{$search}%")
                ->orWhere('week_start', 'like', "%{$search}%")
                ->orWhere('percent_completed', 'like', "%{$search}%")
                ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"))
                ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));
        });
    }

    private function weekBoundaryStart(string $date): string
    {
        return Carbon::parse($date)->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    private function weekBoundaryEnd(string $date): string
    {
        return Carbon::parse($date)->endOfWeek(Carbon::SUNDAY)->toDateString();
    }

    private function applyFilters(Builder $builder, array $filters): void
    {
        $projectId = trim((string) ($filters['project_id'] ?? ''));
        $foremanId = trim((string) ($filters['foreman_id'] ?? ''));
        $weekFrom = trim((string) ($filters['week_from'] ?? ''));
        $weekTo = trim((string) ($filters['week_to'] ?? ''));
        $dateFrom = trim((string) ($filters['date_from'] ?? ''));
        $dateTo = trim((string) ($filters['date_to'] ?? ''));

        if ($projectId !== '') {
            $builder->where('project_id', (int) $projectId);
        }
        if ($foremanId !== '') {
            $builder->where('foreman_id', (int) $foremanId);
        }
        if ($weekFrom !== '') {
            // Treat the picked date as the week that contains it, so a mid-week
            // date like 2026-09-01 still matches the 2026-08-31 week bucket.
            $builder->whereDate('week_start', '>=', $this->weekBoundaryStart($weekFrom));
        }
        if ($weekTo !== '') {
            $builder->whereDate('week_start', '<=', $this->weekBoundaryEnd($weekTo));
        }
        if ($dateFrom !== '') {
            $builder->whereDate('updated_at', '>=', $dateFrom);
        }
        if ($dateTo !== '') {
            $builder->whereDate('updated_at', '<=', $dateTo);
        }
    }

    public function filterProjects(): Collection
    {
        return Project::query()
            ->whereRaw('LOWER(TRIM(COALESCE(phase, \'\'))) != ?', [strtolower(Project::PHASE_DESIGN)])
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    public function filterForemen(): Collection
    {
        return \App\Models\User::query()
            ->where('role', \App\Models\User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname']);
    }
}
