<?php

namespace App\Repositories\Contracts;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface ClientRepositoryInterface
{
    public function paginateClients(string $search, int $perPage): LengthAwarePaginator;

    public function latestAssignmentsByUserIds(array $userIds): Collection;

    public function createClient(array $attributes): User;

    public function updateClient(User $user, array $attributes): void;

    public function upsertDetail(User $user, array $detailData): void;

    public function upsertClientAssignment(User $user, int $projectId): void;

    public function deleteOtherClientAssignments(User $user, int $projectId): void;

    public function deleteClientAssignments(User $user): void;

    public function deleteClient(User $user): void;
}
