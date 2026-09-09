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
        abort_unless(in_array($user->role, [User::ROLE_HEAD_ADMIN, User::ROLE_MASTER_ADMIN, User::ROLE_ADMIN, User::ROLE_DESIGNER], true), 403);
    }

    public const BOARD_SORT_KEYS = [
        'default',
        'project_name',
        'client_name',
        'start_date',
        'due_date',
        'date_paid',
        'progress_percent',
        'status',
    ];

    public function indexPayload(
        User $user,
        array $departmentPages = [],
        array $departmentSizes = [],
        string $search = '',
        array $sort = []
    ): array {
        $search = trim($search);
        $rows = $this->monitoringBoardRepository->listFilteredItems($user, $search);

        $prepared = $rows->map(fn (MonitoringBoardItem $item) => [
            'model' => $item,
            'group' => ($name = trim((string) $item->department)) === '' ? 'General' : $name,
            'computed_progress' => $this->computedDesignProgress($item->design_computation_basis),
        ])->values();

        $departments = $this->monitoringBoardRepository->listVisibleDepartments($user);

        $rowNames = $departments
            ->map(fn (MonitoringBoardDepartment $department) => trim((string) $department->name))
            ->filter()
            ->values()
            ->all();
        $itemGroups = $prepared->map(fn (array $row) => $row['group'])->unique()->values()->all();
        $groupNames = array_values(array_unique(array_merge($rowNames, $itemGroups)));
        if ($search !== '') {
            $withRows = array_flip($itemGroups);
            $groupNames = array_values(array_filter($groupNames, fn (string $name) => isset($withRows[$name])));
        } elseif (!in_array(self::COMPLETED_DEPARTMENT, $groupNames, true)) {
            // The locked Completed section always displays, even when empty.
            $groupNames[] = self::COMPLETED_DEPARTMENT;
        }

        $projectIds = $prepared
            ->map(fn (array $row) => $row['model']->project_id)
            ->filter()
            ->unique()
            ->values()
            ->all();
        $existingProjectLookup = array_fill_keys(
            $this->monitoringBoardRepository->existingProjectIds($projectIds),
            true
        );

        $orderedGroups = [];
        $pageIds = [];
        $meta = [];
        $normalizedPages = [];
        $normalizedSizes = [];
        foreach ($groupNames as $name) {
            $groupRows = $prepared->filter(fn (array $row) => $row['group'] === $name)->values();
            [$sortKey, $sortDir] = $this->resolveBoardSort($sort, $name);
            $sorted = $this->sortBoardRows($groupRows, $sortKey, $sortDir);
            $total = $sorted->count();
            $perPage = min(100, max(1, (int) ($departmentSizes[$name] ?? 10)));
            $lastPage = max(1, (int) ceil($total / $perPage));
            $page = min(max(1, (int) ($departmentPages[$name] ?? 1)), $lastPage);
            $paged = $sorted->slice(($page - 1) * $perPage, $perPage)->values();

            $latestCreated = null;
            foreach ($groupRows as $row) {
                $timestamp = $this->parseBoardTimestamp($row['model']->created_at);
                if ($timestamp !== null && ($latestCreated === null || $timestamp > $latestCreated)) {
                    $latestCreated = $timestamp;
                }
            }

            $meta[$name] = [
                'total' => $total,
                'page' => $page,
                'per_page' => $perPage,
                'last_page' => $lastPage,
                'latest_created_at' => $latestCreated !== null ? date('Y-m-d H:i:s', $latestCreated) : null,
            ];
            $normalizedPages[$name] = $page;
            $normalizedSizes[$name] = $perPage;
            $orderedGroups[$name] = $paged;
            foreach ($paged as $row) {
                $pageIds[] = $row['model']->id;
            }
        }

        // Newest activity first, then name; Completed always last.
        uksort($orderedGroups, function (string $a, string $b) use ($meta) {
            if ($a === self::COMPLETED_DEPARTMENT) {
                return 1;
            }
            if ($b === self::COMPLETED_DEPARTMENT) {
                return -1;
            }
            $latestA = $meta[$a]['latest_created_at'] ?? null;
            $latestB = $meta[$b]['latest_created_at'] ?? null;
            $timeA = $latestA !== null ? strtotime($latestA) : 0;
            $timeB = $latestB !== null ? strtotime($latestB) : 0;
            if ($timeA !== $timeB) {
                return $timeB <=> $timeA;
            }
            $nameOrder = strcasecmp($a, $b);
            return $nameOrder !== 0 ? $nameOrder : strcmp($a, $b);
        });

        $modelsById = $this->monitoringBoardRepository->itemsWithFilesByIds($pageIds);
        $items = [];
        foreach ($orderedGroups as $rows) {
            foreach ($rows as $row) {
                $model = $modelsById->get($row['model']->id);
                if ($model instanceof MonitoringBoardItem) {
                    $items[] = $this->mapBoardItem($model, $existingProjectLookup, $row['computed_progress']);
                }
            }
        }

        $page = $this->pageByRole($user);

        return [
            'page' => $page,
            'props' => [
                'items' => $items,
                'search' => $search,
                'department_meta' => $meta,
                'department_pagination' => [
                    'pages' => $normalizedPages,
                    'sizes' => $normalizedSizes,
                ],
                'departments' => $departments
                    ->map(fn (MonitoringBoardDepartment $department) => [
                        'id' => (int) $department->id,
                        'name' => $department->name,
                        'created_by' => (int) $department->created_by,
                    ])
                    ->values(),
                'status_options' => MonitoringBoardItem::statusOptions(),
                'designerOptions' => $this->designerOptionsPayload(),
            ],
        ];
    }

    /**
     * Resolve the effective sort key/dir for a department: per-department
     * override wins, otherwise the global sort. Unknown keys fall back.
     *
     * @return array{0: string, 1: string}
     */
    private function resolveBoardSort(array $sort, string $department): array
    {
        $override = $sort['departments'][$department] ?? null;
        $key = is_array($override) ? ($override['key'] ?? null) : null;
        $dir = is_array($override) ? ($override['dir'] ?? null) : null;
        if (!in_array($key, self::BOARD_SORT_KEYS, true)) {
            $key = $sort['key'] ?? null;
        }
        if (!in_array($key, self::BOARD_SORT_KEYS, true)) {
            $key = 'default';
        }
        if (!is_string($dir) || ($dir !== 'asc' && $dir !== 'desc')) {
            $dir = is_string($sort['dir'] ?? null) && $sort['dir'] === 'asc' ? 'asc' : 'desc';
        }

        return [$key, $dir];
    }

    /**
     * Weighted milestone progress, mirroring computeDesignProgressWithBasis
     * on the board. Rows without a basis compute to 0 there as well.
     */
    private function computedDesignProgress(mixed $basis): float
    {
        if (!is_array($basis)) {
            return 0.0;
        }
        $sum = 0.0;
        foreach ($basis as $row) {
            if (!is_array($row)) {
                continue;
            }
            $sum += ((float) ($row['percent'] ?? 0)) * ((float) ($row['progress'] ?? 0)) / 100;
        }

        return max(0, min(100, round($sum, 2)));
    }

    private function parseBoardTimestamp(mixed $value): ?int
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->getTimestamp();
        }
        if (!is_string($value) || trim($value) === '') {
            return null;
        }
        $timestamp = strtotime($value);

        return $timestamp === false ? null : $timestamp;
    }

    /**
     * Sort value port of the board's getSortValue: nulls sort last in both
     * directions, ties break by id ascending (stable order).
     */
    private function boardSortValue(array $row, string $key): int|float|string|null
    {
        $model = $row['model'];
        if ($key === 'progress_percent') {
            return (float) $row['computed_progress'];
        }
        if ($key === 'default' || $key === 'created_at') {
            $timestamp = $this->parseBoardTimestamp($model->created_at);
            if ($timestamp === null) {
                $timestamp = $this->parseBoardTimestamp($model->updated_at);
            }
            return $timestamp ?? (is_numeric($model->id) ? (int) $model->id : null);
        }
        if (str_ends_with($key, '_date')) {
            return $this->parseBoardTimestamp($model->{$key} ?? null);
        }
        $raw = $model->{$key} ?? null;
        if ($raw === null || $raw === '') {
            return null;
        }

        return mb_strtolower((string) $raw);
    }

    /**
     * @param \Illuminate\Support\Collection<int, array> $rows
     * @return \Illuminate\Support\Collection<int, array>
     */
    private function sortBoardRows($rows, string $key, string $dir): \Illuminate\Support\Collection
    {
        $effectiveKey = $key === 'default' ? 'created_at' : $key;
        $direction = $dir === 'asc' ? 1 : -1;

        return $rows->sort(function (array $a, array $b) use ($effectiveKey, $direction) {
            $left = $this->boardSortValue($a, $effectiveKey);
            $right = $this->boardSortValue($b, $effectiveKey);
            if ($left === null && $right === null) {
                $result = 0;
            } elseif ($left === null) {
                return 1;
            } elseif ($right === null) {
                return -1;
            } else {
                $result = $left <=> $right;
            }
            if ($result === 0) {
                return $a['model']->id <=> $b['model']->id;
            }

            return $result * $direction;
        })->values();
    }

    private function mapBoardItem(MonitoringBoardItem $item, array $existingProjectLookup, float $computedProgress): array
    {
        return [
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
            'computed_progress' => $computedProgress,
            'remarks' => $item->remarks,
            'design_contract_amount' => $item->design_contract_amount,
            'downpayment' => $item->downpayment,
            'total_received' => $item->total_received,
            'office_payroll_deduction' => $item->office_payroll_deduction,
            'client_approval_status' => $item->client_approval_status,
            'design_computation_basis' => $item->design_computation_basis,
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
        ];
    }

    public function storeItem(array $validated, int $userId): void
    {
        $payload = $this->normalizeItemPayload($validated);
        $payload = $this->applyCompletedDepartment(null, $payload);
        $payload['created_by'] = $userId;
        $this->ensureDepartmentRecords($payload, $userId);

        $this->monitoringBoardRepository->createItem($payload);
    }

    public function updateItem(MonitoringBoardItem $item, array $validated): void
    {
        $payload = $this->normalizeItemPayload($validated);
        $payload = $this->applyCompletedDepartment($item, $payload);
        $this->ensureDepartmentRecords($payload, $item->created_by);

        $this->monitoringBoardRepository->updateItem($item, $payload);
    }

    public function deleteItem(MonitoringBoardItem $item): void
    {
        $this->monitoringBoardRepository->deleteItem($item);
    }

    /**
     * Abort unless the given user is allowed to see this design item. Mirrors
     * the master-admin / legacy account rules used by scopeVisibleTo().
     */
    public function assertVisibleTo(User $user, MonitoringBoardItem $item): void
    {
        abort_unless(
            MonitoringBoardItem::query()->visibleTo($user)->whereKey($item->getKey())->exists(),
            403
        );
    }

    private function departmentVisibleTo(User $user, MonitoringBoardDepartment $department): bool
    {
        return $this->monitoringBoardRepository
            ->listVisibleDepartments($user)
            ->contains(fn (MonitoringBoardDepartment $visible) => (int) $visible->id === (int) $department->id);
    }

    public function deleteDepartment(User $user, MonitoringBoardDepartment $department): void
    {
        if (trim((string) $department->name) === self::COMPLETED_DEPARTMENT) {
            abort(422, 'Completed department cannot be deleted.');
        }

        abort_unless($this->departmentVisibleTo($user, $department), 403);

        // Remove the acting user's own items in this department.
        $this->monitoringBoardRepository->deleteItemsByDepartment($department->name, $user);

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
        return in_array($user->role, [User::ROLE_HEAD_ADMIN, User::ROLE_MASTER_ADMIN], true)
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

        $validated['design_contract_amount'] = is_numeric($validated['design_contract_amount'] ?? null)
            ? (float) $validated['design_contract_amount']
            : null;
        $validated['downpayment'] = is_numeric($validated['downpayment'] ?? null)
            ? (float) $validated['downpayment']
            : null;
        $validated['total_received'] = is_numeric($validated['total_received'] ?? null)
            ? (float) $validated['total_received']
            : null;
        $validated['office_payroll_deduction'] = is_numeric($validated['office_payroll_deduction'] ?? null)
            ? (float) $validated['office_payroll_deduction']
            : null;
        $validated['client_approval_status'] = trim((string) ($validated['client_approval_status'] ?? ''));
        if ($validated['client_approval_status'] === '') {
            $validated['client_approval_status'] = null;
        }

        if (array_key_exists('design_computation_basis', $validated)) {
            if (!is_array($validated['design_computation_basis'])) {
                $validated['design_computation_basis'] = null;
            } else {
                $sanitizedBasis = [];
                foreach ($validated['design_computation_basis'] as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $label = trim((string) ($row['label'] ?? ''));
                    $percent = is_numeric($row['percent'] ?? null) ? (float) $row['percent'] : 0;
                    $progress = is_numeric($row['progress'] ?? null) ? (float) $row['progress'] : 0;
                    $key = trim((string) ($row['key'] ?? ''));
                    $entry = [
                        'label' => $label,
                        'percent' => $percent,
                        'progress' => $progress,
                    ];
                    if ($key !== '') {
                        $entry['key'] = $key;
                    }
                    $sanitizedBasis[] = $entry;
                }
                $validated['design_computation_basis'] = $sanitizedBasis;
            }
        }

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

    private function ensureDepartmentRecords(array $payload, int $userId): void
    {
        $department = trim((string) ($payload['department'] ?? ''));
        if ($department === '' || $department === self::COMPLETED_DEPARTMENT) {
            return;
        }
        $this->monitoringBoardRepository->ensureDepartmentExists($department, $userId);
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
