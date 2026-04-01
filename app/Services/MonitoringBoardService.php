<?php

namespace App\Services;

use App\Models\MonitoringBoardFile;
use App\Models\MonitoringBoardDepartment;
use App\Models\MonitoringBoardItem;
use App\Models\User;
use App\Repositories\Contracts\MonitoringBoardRepositoryInterface;
use Illuminate\Http\UploadedFile;

class MonitoringBoardService
{
    private const COMPLETED_DEPARTMENT = 'Completed';

    public function __construct(
        private readonly MonitoringBoardRepositoryInterface $monitoringBoardRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, [User::ROLE_HEAD_ADMIN, User::ROLE_ADMIN, User::ROLE_DESIGNER], true), 403);
    }

    public function indexPayload(User $user, array $departmentPages = [], array $departmentSizes = []): array
    {
        $rawItems = $this->monitoringBoardRepository->listItemsWithFiles();
        $departments = $this->monitoringBoardRepository->listDepartments();

        $departmentNames = $departments
            ->pluck('name')
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->values();

        $rawDepartmentNames = $rawItems
            ->map(fn (MonitoringBoardItem $item) => $item->department)
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->reject(fn ($name) => $name === self::COMPLETED_DEPARTMENT)
            ->unique()
            ->values();

        $missingDepartments = $rawDepartmentNames->diff($departmentNames);
        if ($missingDepartments->isNotEmpty()) {
            $missingDepartments->each(fn ($name) => $this->monitoringBoardRepository->ensureDepartmentExists($name));
            $departments = $this->monitoringBoardRepository->listDepartments();
        }

        $projectIds = $rawItems
            ->pluck('project_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $existingProjectIds = $this->monitoringBoardRepository->existingProjectIds($projectIds);
        $existingProjectLookup = array_fill_keys($existingProjectIds, true);

        $items = $rawItems
            ->map(fn (MonitoringBoardItem $item) => [
                'id' => (int) $item->id,
                'department' => $item->department,
                'origin_department' => $item->origin_department,
                'client_name' => $item->client_name,
                'project_name' => $item->project_name,
                'project_type' => $item->project_type,
                'location' => $item->location,
                'assigned_to' => $item->assigned_to,
                'status' => $item->status,
                'start_date' => optional($item->start_date)?->toDateString(),
                'timeline' => $item->timeline,
                'due_date' => optional($item->due_date)?->toDateString(),
                'date_paid' => optional($item->date_paid)?->toDateString(),
                'progress_percent' => (int) $item->progress_percent,
                'remarks' => $item->remarks,
                'project_id' => $item->project_id,
                'project_deleted' => $item->project_id ? !isset($existingProjectLookup[$item->project_id]) : false,
                'converted_at' => optional($item->converted_at)?->toDateTimeString(),
                'completed_at' => optional($item->completed_at ?? $item->updated_at)?->toDateString(),
                'files' => $item->files->map(fn (MonitoringBoardFile $file) => [
                    'id' => (int) $file->id,
                    'file_path' => $file->file_path,
                    'original_name' => $file->original_name,
                    'mime_type' => $file->mime_type,
                    'uploaded_by' => $file->uploaded_by,
                    'created_at' => optional($file->created_at)?->toDateTimeString(),
                ])->values(),
                'created_at' => optional($item->created_at)?->toDateTimeString(),
                'updated_at' => optional($item->updated_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $this->pageByRole($user);

        return [
            'page' => $page,
            'props' => [
                'items' => $items,
                'department_pagination' => [
                    'pages' => $departmentPages,
                    'sizes' => $departmentSizes,
                ],
                'departments' => $departments
                    ->map(fn (MonitoringBoardDepartment $department) => [
                        'id' => (int) $department->id,
                        'name' => $department->name,
                    ])
                    ->values(),
                'status_options' => MonitoringBoardItem::statusOptions(),
                'designerOptions' => $this->designerOptionsPayload(),
            ],
        ];
    }

    public function storeItem(array $validated, int $userId): void
    {
        $payload = $this->normalizeItemPayload($validated);
        $payload = $this->applyCompletedDepartment(null, $payload);
        $payload['created_by'] = $userId;
        $this->ensureDepartmentRecords($payload);

        $this->monitoringBoardRepository->createItem($payload);
    }

    public function updateItem(MonitoringBoardItem $item, array $validated): void
    {
        $payload = $this->normalizeItemPayload($validated);
        $payload = $this->applyCompletedDepartment($item, $payload);
        $this->ensureDepartmentRecords($payload);

        $this->monitoringBoardRepository->updateItem($item, $payload);
    }

    public function deleteItem(MonitoringBoardItem $item): void
    {
        $this->monitoringBoardRepository->deleteItem($item);
    }

    public function deleteDepartment(MonitoringBoardDepartment $department): void
    {
        if (trim((string) $department->name) === self::COMPLETED_DEPARTMENT) {
            abort(422, 'Completed department cannot be deleted.');
        }

        $this->monitoringBoardRepository->deleteItemsByDepartment($department->name);

        $this->monitoringBoardRepository->deleteDepartment($department);
    }

    public function storeFile(MonitoringBoardItem $item, UploadedFile $file, int $userId): void
    {
        $this->monitoringBoardRepository->createItemFile($item, $file, $userId);
    }

    public function deleteFile(MonitoringBoardFile $file): void
    {
        $this->monitoringBoardRepository->deleteItemFile($file);
    }

    public function pageByRole(User $user): string
    {
        return $user->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/MonitoringBoard/Index'
            : 'Admin/MonitoringBoard/Index';
    }

    private function normalizeItemPayload(array $validated): array
    {
        $validated['department'] = trim((string) $validated['department']);
        if ($validated['department'] === '') {
            $validated['department'] = 'General';
        }

        $validated['assigned_to'] = trim((string) ($validated['assigned_to'] ?? ''));
        if ($validated['assigned_to'] === '') {
            $validated['assigned_to'] = null;
        }

        $validated['status'] = strtoupper(trim((string) $validated['status']));
        $validated['status'] = in_array($validated['status'], MonitoringBoardItem::statusOptions(), true)
            ? $validated['status']
            : MonitoringBoardItem::STATUS_OPTIONS[0];

        $progress = is_numeric($validated['progress_percent'] ?? null) ? (int) $validated['progress_percent'] : 0;
        $validated['progress_percent'] = max(0, min(100, $progress));

        return $validated;
    }

    private function applyCompletedDepartment(?MonitoringBoardItem $item, array $payload): array
    {
        $status = strtoupper(trim((string) ($payload['status'] ?? '')));
        $currentDepartment = trim((string) ($payload['department'] ?? ''));

        if ($status === MonitoringBoardItem::STATUS_DONE) {
            $origin = trim((string) ($item?->origin_department ?? ''));
            if ($origin === '') {
                $origin = $item?->department && trim((string) $item->department) !== self::COMPLETED_DEPARTMENT
                    ? trim((string) $item->department)
                    : $currentDepartment;
            }
            if ($origin === '' || $origin === self::COMPLETED_DEPARTMENT) {
                $origin = 'General';
            }
            if (empty($payload['completed_at'])) {
                $payload['completed_at'] = $item?->completed_at ?? now();
            }
            $payload['origin_department'] = $origin;
            $payload['department'] = self::COMPLETED_DEPARTMENT;
            return $payload;
        }

        if ($item && trim((string) $item->department) === self::COMPLETED_DEPARTMENT) {
            $origin = trim((string) ($item->origin_department ?? ''));
            if ($origin !== '') {
                $payload['department'] = $origin;
            }
            $payload['origin_department'] = null;
        }
        $payload['completed_at'] = null;

        return $payload;
    }

    private function ensureDepartmentRecords(array $payload): void
    {
        $department = trim((string) ($payload['department'] ?? ''));
        if ($department === '' || $department === self::COMPLETED_DEPARTMENT) {
            return;
        }
        $this->monitoringBoardRepository->ensureDepartmentExists($department);
    }

    private function designerOptionsPayload(): array
    {
        $designers = $this->monitoringBoardRepository->designerUsers();
        return $designers
            ->map(fn ($user) => [
                'id' => (int) $user->id,
                'fullname' => (string) $user->fullname,
                'profile_photo_path' => optional($user->detail)->profile_photo_path,
            ])
            ->values()
            ->all();
    }

}
