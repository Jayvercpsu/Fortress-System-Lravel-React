<?php

namespace App\Repositories;

use App\Models\MaterialRequest;
use App\Models\Project;
use App\Repositories\Contracts\MaterialRequestRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class MaterialRequestRepository implements MaterialRequestRepositoryInterface
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

    public function paginateMaterialRequestProjectIds(string $search, string $status, int $perPage): LengthAwarePaginator
    {
        $query = MaterialRequest::query();
        $this->applySearch($query, $search);
        if ($status !== '') {
            $query->where('status', $status);
        }

        return (clone $query)
            ->selectRaw('project_id, MAX(created_at) as last_created_at')
            ->groupBy('project_id')
            ->orderByDesc('last_created_at')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function listByProjectIds(array $projectIds, string $search, string $status): Collection
    {
        if (empty($projectIds)) {
            return collect();
        }

        $query = MaterialRequest::query()
            ->with(['foreman:id,fullname', 'project:id,name']);
        $this->applySearch($query, $search);
        if ($status !== '') {
            $query->where('status', $status);
        }

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

    public function updateStatus(MaterialRequest $materialRequest, string $status): void
    {
        $materialRequest->update(['status' => $status]);
    }

    private function applySearch(Builder $builder, string $search): void
    {
        if ($search === '') {
            return;
        }

        $builder->where(function ($query) use ($search) {
            $query->where('material_name', 'like', "%{$search}%")
                ->orWhere('quantity', 'like', "%{$search}%")
                ->orWhere('unit', 'like', "%{$search}%")
                ->orWhere('remarks', 'like', "%{$search}%")
                ->orWhere('status', 'like', "%{$search}%")
                ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"))
                ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"));
        });
    }
}
