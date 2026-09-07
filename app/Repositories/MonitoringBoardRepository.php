<?php

namespace App\Repositories;

use App\Enums\ProjectStatus;
use App\Models\MonitoringBoardFile;
use App\Models\MonitoringBoardDepartment;
use App\Models\MonitoringBoardItem;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use App\Repositories\Contracts\MonitoringBoardRepositoryInterface;
use App\Support\Projects\ProjectFlow;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Database\Eloquent\Builder;

class MonitoringBoardRepository implements MonitoringBoardRepositoryInterface
{
    public function listItemsWithFiles(User $user): Collection
    {
        return MonitoringBoardItem::query()
            ->visibleTo($user)
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

    public function designerUsers(): Collection
    {
        return User::query()
            ->with('detail:id,user_id,profile_photo_path')
            ->where('role', User::ROLE_DESIGNER)
            ->orderBy('fullname')
            ->get(['id', 'fullname']);
    }

    /**
     * Return only the departments the given user is allowed to see.
     *
     * Departments are scoped by their creator, mirroring the item rules:
     * - master_admin sees every department.
     * - The legacy buildbooks account sees its own and master-admin-created
     *   departments (never designer/admin/other head-admin creations).
     * - All other roles see only departments they created.
     * Rows without a creator are visible to the master admin only.
     */
    public function listVisibleDepartments(User $user): Collection
    {
        $query = MonitoringBoardDepartment::query()
            ->select(['id', 'name', 'created_by']);

        if ($user->role === User::ROLE_MASTER_ADMIN) {
            return $query->orderBy('name')->get();
        }

        if ($user->email === User::LEGACY_PROJECT_ACCESS_EMAIL) {
            return $query
                ->where(function (Builder $builder) use ($user) {
                    $builder
                        ->where('created_by', $user->id)
                        ->orWhereIn('created_by', User::query()->where('role', User::ROLE_MASTER_ADMIN)->select('id'));
                })
                ->orderBy('name')
                ->get();
        }

        return $query
            ->where('created_by', $user->id)
            ->orderBy('name')
            ->get();
    }

    public function createDepartment(string $name, int $createdBy): MonitoringBoardDepartment
    {
        return MonitoringBoardDepartment::create([
            'name' => trim((string) $name),
            'created_by' => $createdBy,
        ]);
    }

    public function ensureDepartmentExists(string $name, int $createdBy): MonitoringBoardDepartment
    {
        $normalized = trim((string) $name);
        $department = MonitoringBoardDepartment::withTrashed()->firstOrCreate([
            'name' => $normalized,
            'created_by' => $createdBy,
        ]);

        if ($department->trashed()) {
            $department->restore();
        }

        return $department;
    }

    public function deleteItemsByDepartment(string $departmentName, User $user): void
    {
        $normalized = trim((string) $departmentName);
        if ($normalized === '') {
            return;
        }

        MonitoringBoardItem::query()
            ->visibleTo($user)
            ->where('department', $normalized)
            ->get()
            ->each(fn (MonitoringBoardItem $item) => $this->deleteItem($item));
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

    public function deleteDepartment(MonitoringBoardDepartment $department): void
    {
        $department->delete();
    }
}
