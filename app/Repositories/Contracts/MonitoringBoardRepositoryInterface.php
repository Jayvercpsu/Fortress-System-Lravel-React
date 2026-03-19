<?php

namespace App\Repositories\Contracts;

use App\Models\MonitoringBoardFile;
use App\Models\MonitoringBoardItem;
use App\Models\Project;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;

interface MonitoringBoardRepositoryInterface
{
    public function listItemsWithFiles(): Collection;

    public function existingProjectIds(array $projectIds): array;

    public function clientUsers(): Collection;

    public function foremanUsers(): Collection;

    public function latestAssignmentsByUserIds(array $userIds, string $role): Collection;

    public function createItem(array $attributes): MonitoringBoardItem;

    public function updateItem(MonitoringBoardItem $item, array $attributes): void;

    public function deleteItem(MonitoringBoardItem $item): void;

    public function createProjectFromMonitoringItem(MonitoringBoardItem $item): Project;

    public function markItemConverted(MonitoringBoardItem $item, int $projectId, string $status): void;

    public function createItemFile(MonitoringBoardItem $item, UploadedFile $file, int $userId): void;

    public function deleteItemFile(MonitoringBoardFile $file): void;
}
