<?php

namespace App\Repositories;

use App\Models\DesignProject;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ScopePhoto;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\ClientPortalRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class ClientPortalRepository implements ClientPortalRepositoryInterface
{
    public function latestClientAssignment(int $clientUserId): ?ProjectAssignment
    {
        return ProjectAssignment::query()
            ->where('user_id', $clientUserId)
            ->where('role_in_project', ProjectAssignment::ROLE_CLIENT)
            ->latest('id')
            ->first();
    }

    public function summaryProjectByFamilyIds(array $familyProjectIds): ?object
    {
        if (empty($familyProjectIds)) {
            return null;
        }

        $constructionPhase = strtolower(Project::PHASE_CONSTRUCTION);
        $completedPhase = strtolower(Project::PHASE_COMPLETED);
        $designPhase = strtolower(Project::PHASE_DESIGN);

        return Project::query()
            ->whereIn('id', $familyProjectIds)
            ->orderByRaw("
                CASE
                    WHEN LOWER(TRIM(COALESCE(phase, ''))) = '{$constructionPhase}' THEN 0
                    WHEN LOWER(TRIM(COALESCE(phase, ''))) = '{$completedPhase}' THEN 1
                    WHEN LOWER(TRIM(COALESCE(phase, ''))) = '{$designPhase}' THEN 2
                    ELSE 3
                END
            ")
            ->orderByDesc('updated_at')
            ->first();
    }

    public function designDownpaymentForProject(int $projectId): float
    {
        if ($projectId <= 0) {
            return 0.0;
        }

        return (float) (DesignProject::query()
            ->where('project_id', $projectId)
            ->value('downpayment') ?? 0);
    }

    public function paginateProgressPhotos(array $projectIds, string $search, int $perPage): LengthAwarePaginator
    {
        $query = ProgressPhoto::query()
            ->with('foreman:id,fullname', 'project:id,name')
            ->when(
                empty($projectIds),
                fn ($builder) => $builder->whereRaw('0 = 1'),
                fn ($builder) => $builder->whereIn('project_id', $projectIds)
            );

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('caption', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($foremanQuery) => $foremanQuery->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($projectQuery) => $projectQuery->where('name', 'like', "%{$search}%"));
            });
        }

        return $query
            ->latest()
            ->paginate($perPage, ['*'], 'photos_page')
            ->withQueryString();
    }

    public function paginateWeeklyAccomplishments(array $projectIds, string $search, int $perPage): LengthAwarePaginator
    {
        $query = WeeklyAccomplishment::query()
            ->with('foreman:id,fullname', 'project:id,name')
            ->when(
                empty($projectIds),
                fn ($builder) => $builder->whereRaw('0 = 1'),
                fn ($builder) => $builder->whereIn('project_id', $projectIds)
            );

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('scope_of_work', 'like', "%{$search}%")
                    ->orWhere('week_start', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($foremanQuery) => $foremanQuery->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($projectQuery) => $projectQuery->where('name', 'like', "%{$search}%"));
            });
        }

        return $query
            ->latest()
            ->paginate($perPage, ['*'], 'accomplishments_page')
            ->withQueryString();
    }

    public function scopePhotosForProjectIds(array $projectIds): Collection
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
}
