<?php

namespace App\Repositories\Contracts;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface UserRepositoryInterface
{
    public function paginateForManagement(string $search, int $perPage): LengthAwarePaginator;

    public function loadDetail(User $user): User;

    public function createUser(array $attributes): User;

    public function updateUser(User $user, array $attributes): void;

    public function upsertDetail(User $user, array $detailData): void;

    public function deleteUser(User $user): void;
}
