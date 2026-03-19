<?php

namespace App\Repositories;

use App\Models\User;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class UserRepository implements UserRepositoryInterface
{
    public function paginateForManagement(string $search, int $perPage): LengthAwarePaginator
    {
        $query = User::query()->whereNotIn('role', [User::ROLE_HEAD_ADMIN, User::ROLE_CLIENT]);

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
        $user->delete();
    }
}
