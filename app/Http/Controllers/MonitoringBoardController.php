<?php

namespace App\Http\Controllers;

use App\Http\Requests\MonitoringBoards\StoreMonitoringBoardFileRequest;
use App\Http\Requests\MonitoringBoards\StoreMonitoringBoardItemRequest;
use App\Http\Requests\MonitoringBoards\UpdateMonitoringBoardItemRequest;
use App\Models\MonitoringBoardDepartment;
use App\Models\MonitoringBoardFile;
use App\Models\MonitoringBoardItem;
use App\Services\MonitoringBoardService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MonitoringBoardController extends Controller
{
    public function __construct(
        private readonly MonitoringBoardService $monitoringBoardService
    ) {
    }

    public function index(Request $request)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());

        $departmentPages = $request->query('dept_page', []);
        $departmentSizes = $request->query('dept_size', []);
        $departmentSorts = $request->query('dept_sort', []);
        if (is_string($departmentPages)) {
            $departmentPages = json_decode($departmentPages, true) ?? [];
        }
        if (is_string($departmentSizes)) {
            $departmentSizes = json_decode($departmentSizes, true) ?? [];
        }
        if (is_string($departmentSorts)) {
            $departmentSorts = json_decode($departmentSorts, true) ?? [];
        }
        if (!is_array($departmentPages)) {
            $departmentPages = [];
        }
        if (!is_array($departmentSizes)) {
            $departmentSizes = [];
        }
        if (!is_array($departmentSorts)) {
            $departmentSorts = [];
        }

        $payload = $this->monitoringBoardService->indexPayload(
            $request->user(),
            $departmentPages,
            $departmentSizes,
            trim((string) $request->query('search', '')),
            [
                'key' => (string) $request->query('sort_key', 'default'),
                'dir' => (string) $request->query('sort_dir', 'desc'),
                'departments' => $departmentSorts,
            ]
        );

        return Inertia::render($payload['page'], $payload['props']);
    }

    public function store(StoreMonitoringBoardItemRequest $request)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());
        $this->monitoringBoardService->storeItem($request->validated(), (int) $request->user()->id);

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', __('messages.monitoring_board.created'));
    }

    public function update(UpdateMonitoringBoardItemRequest $request, MonitoringBoardItem $item)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());
        $this->monitoringBoardService->assertVisibleTo($request->user(), $item);
        $this->monitoringBoardService->updateItem($item, $request->validated());

        // Send Inertia back to the page the edit was submitted from so the
        // board's existing filter and pagination params are preserved.
        return redirect()
            ->back()
            ->with('success', __('messages.monitoring_board.updated'));
    }

    public function destroy(Request $request, string $item)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());
        $model = MonitoringBoardItem::query()->find($item);

        if ($model === null) {
            // The entry is already gone (double-click, stale row, or garbage
            // id). Refresh the board instead of landing on a 404 page at
            // /design/{id}. 303 makes API clients follow the redirect with
            // GET instead of replaying DELETE against /design (405).
            return redirect()
                ->route('monitoring-board.index', [], 303)
                ->with('success', __('messages.monitoring_board.already_deleted'));
        }

        $this->monitoringBoardService->assertVisibleTo($request->user(), $model);
        $this->monitoringBoardService->deleteItem($model);

        return redirect()
            ->route('monitoring-board.index', [], 303)
            ->with('success', __('messages.monitoring_board.deleted'));
    }

    public function destroyDepartment(Request $request, MonitoringBoardDepartment $department)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());
        $this->monitoringBoardService->deleteDepartment($request->user(), $department);

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', __('messages.monitoring_board.department_deleted'));
    }

    public function storeFile(StoreMonitoringBoardFileRequest $request, MonitoringBoardItem $item)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());
        $this->monitoringBoardService->assertVisibleTo($request->user(), $item);
        $this->monitoringBoardService->storeFile($item, $request->file('file'), (int) $request->user()->id);

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', __('messages.monitoring_board.file_uploaded'));
    }

    public function destroyFile(Request $request, MonitoringBoardFile $file)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());
        $this->monitoringBoardService->assertVisibleTo($request->user(), $file->item);

        $this->monitoringBoardService->deleteFile($file);

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', __('messages.monitoring_board.file_deleted'));
    }
}
