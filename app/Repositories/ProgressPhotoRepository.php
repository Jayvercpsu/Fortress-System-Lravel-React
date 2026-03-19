<?php

namespace App\Repositories;

use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Repositories\Contracts\ProgressPhotoRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class ProgressPhotoRepository implements ProgressPhotoRepositoryInterface
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

    public function paginatePhotoProjectIds(string $search, int $perPage): LengthAwarePaginator
    {
        $query = ProgressPhoto::query();
        $this->applySearch($query, $search);

        return (clone $query)
            ->selectRaw('project_id, MAX(created_at) as last_created_at')
            ->groupBy('project_id')
            ->orderByDesc('last_created_at')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function listByProjectIds(array $projectIds, string $search): Collection
    {
        if (empty($projectIds)) {
            return collect();
        }

        $query = ProgressPhoto::query()
            ->with(['foreman:id,fullname', 'project:id,name']);
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

    private function applySearch(Builder $builder, string $search): void
    {
        if ($search === '') {
            return;
        }

        $builder->where(function ($query) use ($search) {
            $query->where('caption', 'like', "%{$search}%")
                ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"))
                ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));
        });
    }
}
