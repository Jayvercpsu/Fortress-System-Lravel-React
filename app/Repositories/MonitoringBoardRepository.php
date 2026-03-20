<?php

namespace App\Repositories;

use App\Enums\ProjectStatus;
use App\Models\MonitoringBoardFile;
use App\Models\MonitoringBoardItem;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use App\Repositories\Contracts\MonitoringBoardRepositoryInterface;
use App\Support\Projects\ProjectFlow;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;

class MonitoringBoardRepository implements MonitoringBoardRepositoryInterface
{
    public function listItemsWithFiles(): Collection
    {
        return MonitoringBoardItem::query()
            ->with(['files' => fn ($query) => $query->latest('id')])
            ->orderBy('department')
            ->orderByDesc('created_at')
            ->get()
            ->values();
    }

    public function existingProjectIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        return Project::query()
            ->whereIn('id', $projectIds)
            ->pluck('id')
            ->all();
    }

    public function clientUsers(): Collection
    {
        return User::query()
            ->where('role', User::ROLE_CLIENT)
            ->orderBy('fullname')
            ->get(['id', 'fullname']);
    }

    public function foremanUsers(): Collection
    {
        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname']);
    }

    public function latestAssignmentsByUserIds(array $userIds, string $role): Collection
    {
        if (empty($userIds)) {
            return collect();
        }

        return ProjectAssignment::query()
            ->with('project:id,name')
            ->whereIn('user_id', $userIds)
            ->where('role_in_project', $role)
            ->latest('id')
            ->get()
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->first());
    }

    public function createItem(array $attributes): MonitoringBoardItem
    {
        return MonitoringBoardItem::query()->create($attributes);
    }

    public function updateItem(MonitoringBoardItem $item, array $attributes): void
    {
        $item->update($attributes);
    }

    public function deleteItem(MonitoringBoardItem $item): void
    {
        $item->files()
            ->pluck('file_path')
            ->map(fn ($path) => trim((string) $path))
            ->filter(fn (string $path) => $path !== '')
            ->unique()
            ->each(fn (string $path) => UploadManager::delete($path));

        $item->delete();
    }

    public function createProjectFromMonitoringItem(MonitoringBoardItem $item): Project
    {
        return Project::query()->create([
            'name' => $item->project_name,
            'client' => $item->client_name,
            'type' => $item->project_type,
            'location' => $item->location,
            'assigned_role' => null,
            'assigned' => $item->assigned_to ?: null,
            'target' => null,
            'status' => ProjectStatus::PLANNING->value,
            'phase' => ProjectFlow::normalizePhase('Design'),
            'overall_progress' => 0,
        ]);
    }

    public function markItemConverted(MonitoringBoardItem $item, int $projectId, string $status): void
    {
        $item->update([
            'project_id' => $projectId,
            'converted_at' => now(),
            'status' => $status,
        ]);
    }

    public function createItemFile(MonitoringBoardItem $item, UploadedFile $file, int $userId): void
    {
        $path = UploadManager::store($file, 'monitoring-board');

        $item->files()->create([
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'uploaded_by' => $userId,
        ]);
    }

    public function deleteItemFile(MonitoringBoardFile $file): void
    {
        UploadManager::delete($file->file_path);
        $file->delete();
    }
}
