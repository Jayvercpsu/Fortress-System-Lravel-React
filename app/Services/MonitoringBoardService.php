<?php

namespace App\Services;

use App\Models\MonitoringBoardFile;
use App\Models\MonitoringBoardItem;
use App\Models\ProjectAssignment;
use App\Models\User;
use App\Repositories\Contracts\MonitoringBoardRepositoryInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;

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
                'clientOptions' => $this->clientOptionsPayload(),
                'foremanOptions' => $this->foremanOptionsPayload(),
            ],
        ];
    }

    public function storeItem(array $validated, int $userId): void
    {
        $payload = $this->normalizeItemPayload($validated);
        $payload['created_by'] = $userId;

        $item = $this->monitoringBoardRepository->createItem($payload);
        $this->maybeConvertToProject($item);
    }

    public function updateItem(MonitoringBoardItem $item, array $validated): void
    {
        $payload = $this->normalizeItemPayload($validated);

        $this->monitoringBoardRepository->updateItem($item, $payload);
        $this->maybeConvertToProject($item->fresh());
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

        return $validated;
    }

    private function maybeConvertToProject(MonitoringBoardItem $item): void
    {
        if ($item->project_id || (int) $item->progress_percent < 100) {
            return;
        }

        $project = $this->monitoringBoardRepository->createProjectFromMonitoringItem($item);
        $this->monitoringBoardRepository->markItemConverted($item, (int) $project->id, MonitoringBoardItem::STATUS_DONE);
    }

    private function clientOptionsPayload(): array
    {
        $clients = $this->monitoringBoardRepository->clientUsers();
        $clientIds = $clients
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $assignments = $this->monitoringBoardRepository->latestAssignmentsByUserIds($clientIds, ProjectAssignment::ROLE_CLIENT);

        return $this->assignmentOptionsPayload($clients, $assignments);
    }

    private function foremanOptionsPayload(): array
    {
        $foremen = $this->monitoringBoardRepository->foremanUsers();
        $foremanIds = $foremen
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $assignments = $this->monitoringBoardRepository->latestAssignmentsByUserIds($foremanIds, ProjectAssignment::ROLE_FOREMAN);

        return $this->assignmentOptionsPayload($foremen, $assignments);
    }

    private function assignmentOptionsPayload(Collection $users, Collection $assignments): array
    {
        return $users
            ->map(function (User $user) use ($assignments) {
                $assignment = $assignments->get($user->id);
                $projectName = $assignment?->project?->name;
                $label = $projectName
                    ? "{$user->fullname} ({$projectName})"
                    : "{$user->fullname} (Unassigned)";

                return [
                    'id' => (int) $user->id,
                    'label' => $label,
                    'value' => $user->fullname,
                ];
            })
            ->values()
            ->all();
    }
}
