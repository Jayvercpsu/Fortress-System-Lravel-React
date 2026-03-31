<?php

namespace App\Services;

use App\Models\MonitoringBoardFile;
use App\Models\MonitoringBoardItem;
use App\Models\User;
use App\Repositories\Contracts\MonitoringBoardRepositoryInterface;
use Illuminate\Http\UploadedFile;

class MonitoringBoardService
{
    public function __construct(
        private readonly MonitoringBoardRepositoryInterface $monitoringBoardRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function indexPayload(User $user): array
    {
        $rawItems = $this->monitoringBoardRepository->listItemsWithFiles();

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
                'status_options' => MonitoringBoardItem::statusOptions(),
                'foremanOptions' => $this->foremanOptionsPayload(),
            ],
        ];
    }

    public function storeItem(array $validated, int $userId): void
    {
        $payload = $this->normalizeItemPayload($validated);
        $payload['created_by'] = $userId;

        $this->monitoringBoardRepository->createItem($payload);
    }

    public function updateItem(MonitoringBoardItem $item, array $validated): void
    {
        $payload = $this->normalizeItemPayload($validated);

        $this->monitoringBoardRepository->updateItem($item, $payload);
    }

    public function deleteItem(MonitoringBoardItem $item): void
    {
        $this->monitoringBoardRepository->deleteItem($item);
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

    private function foremanOptionsPayload(): array
    {
        $foremen = $this->monitoringBoardRepository->foremanUsers();
        return $foremen
            ->map(fn ($user) => [
                'id' => (int) $user->id,
                'fullname' => (string) $user->fullname,
            ])
            ->values()
            ->all();
    }

}
