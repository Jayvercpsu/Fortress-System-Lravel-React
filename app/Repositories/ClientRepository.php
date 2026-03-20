<?php

namespace App\Repositories;

use App\Models\ProjectAssignment;
use App\Models\User;
use App\Repositories\Contracts\ClientRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class ClientRepository implements ClientRepositoryInterface
{
    public function paginateClients(string $search, int $perPage): LengthAwarePaginator
    {
        $query = User::query()
            ->where('role', User::ROLE_CLIENT)
            ->with('detail');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('fullname', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhereHas('detail', function ($detailQuery) use ($search) {
                        $detailQuery
                            ->where('phone', 'like', "%{$search}%")
                            ->orWhere('address', 'like', "%{$search}%");
                    })
                    ->orWhereHas('projectAssignments', function ($assignmentQuery) use ($search) {
                        $assignmentQuery
                            ->where('role_in_project', ProjectAssignment::ROLE_CLIENT)
                            ->whereHas('project', fn ($projectQuery) => $projectQuery->where('name', 'like', "%{$search}%"));
                    });
            });
        }

        return $query
            ->latest()
            ->paginate($perPage)
            ->withQueryString();
    }

    public function latestAssignmentsByUserIds(array $userIds): Collection
    {
        if (empty($userIds)) {
            return collect();
        }

        return ProjectAssignment::query()
            ->with('project:id,name')
            ->whereIn('user_id', $userIds)
            ->where('role_in_project', ProjectAssignment::ROLE_CLIENT)
            ->latest('id')
            ->get()
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->first());
    }

    public function createClient(array $attributes): User
    {
        return User::query()->create($attributes);
    }

    public function updateClient(User $user, array $attributes): void
    {
        $user->update($attributes);
    }

    public function upsertDetail(User $user, array $detailData): void
    {
        $user->detail()->updateOrCreate(
            ['user_id' => $user->id],
            $detailData
        );
    }

    public function upsertClientAssignment(User $user, int $projectId): void
    {
        ProjectAssignment::query()->updateOrCreate(
            [
                'project_id' => $projectId,
                'user_id' => $user->id,
            ],
            [
                'role_in_project' => ProjectAssignment::ROLE_CLIENT,
            ]
        );
    }

    public function deleteOtherClientAssignments(User $user, int $projectId): void
    {
        ProjectAssignment::query()
            ->where('user_id', $user->id)
            ->where('role_in_project', ProjectAssignment::ROLE_CLIENT)
            ->where('project_id', '!=', $projectId)
            ->delete();
    }

    public function deleteClientAssignments(User $user): void
    {
        ProjectAssignment::query()
            ->where('user_id', $user->id)
            ->where('role_in_project', ProjectAssignment::ROLE_CLIENT)
            ->delete();
    }

    public function deleteClient(User $user): void
    {
        $user->loadMissing('detail');
        UploadManager::delete($user->detail?->profile_photo_path);
        $user->delete();
    }
}
