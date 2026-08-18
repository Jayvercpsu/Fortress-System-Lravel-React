<?php

namespace App\Repositories;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class UserRepository implements UserRepositoryInterface
{
    public function paginateForManagement(string $search, int $perPage, ?string $managerRole = null): LengthAwarePaginator
    {
        // Master admins are never managed from the Users page. Head admins are
        // only visible to the master admin, who owns and manages them.
        $excludedRoles = [User::ROLE_MASTER_ADMIN, User::ROLE_CLIENT];
        if ($managerRole !== User::ROLE_MASTER_ADMIN) {
            $excludedRoles[] = User::ROLE_HEAD_ADMIN;
        }

        $query = User::query()->whereNotIn('role', $excludedRoles);

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('fullname', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('role', 'like', "%{$search}%");
            });
        }

        return $query
            ->latest()
            ->paginate($perPage)
            ->withQueryString();
    }

    public function loadDetail(User $user): User
    {
        return $user->load('detail');
    }

    public function createUser(array $attributes): User
    {
        return User::query()->create($attributes);
    }

    public function updateUser(User $user, array $attributes): void
    {
        $user->fill($attributes);
        $user->save();
    }

    public function upsertDetail(User $user, array $detailData): void
    {
        $user->detail()->updateOrCreate(
            ['user_id' => $user->id],
            $detailData
        );
    }

    public function deleteUser(User $user): void
    {
        $user->loadMissing('detail');
        UploadManager::delete($user->detail?->profile_photo_path);
        $user->delete();
    }
}
