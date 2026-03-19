<?php

namespace App\Repositories;

use App\Models\Project;
use App\Models\ScopePhoto;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\WeeklyAccomplishmentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
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

    public function paginateWeeklyProjectIds(string $search, int $perPage): LengthAwarePaginator
    {
        $query = WeeklyAccomplishment::query();
        $this->applySearch($query, $search);

        return (clone $query)
            ->selectRaw('project_id, MAX(created_at) as last_created_at')
            ->groupBy('project_id')
            ->orderByDesc('last_created_at')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function listWeeklyAccomplishmentsByProjectIds(array $projectIds, string $search): Collection
    {
        if (empty($projectIds)) {
            return collect();
        }

        $query = WeeklyAccomplishment::query()
            ->with('foreman:id,fullname', 'project:id,name');
        $this->applySearch($query, $search);

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

        return $query->latest()->get();
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
}
