<?php

namespace App\Http\Controllers;

use App\Http\Requests\MonitoringBoards\StoreMonitoringBoardFileRequest;
use App\Http\Requests\MonitoringBoards\StoreMonitoringBoardItemRequest;
use App\Http\Requests\MonitoringBoards\UpdateMonitoringBoardItemRequest;
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

        $payload = $this->monitoringBoardService->indexPayload($request->user());

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
        $this->monitoringBoardService->updateItem($item, $request->validated());

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', __('messages.monitoring_board.updated'));
    }

    public function destroy(Request $request, MonitoringBoardItem $item)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());
        $this->monitoringBoardService->deleteItem($item);

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', __('messages.monitoring_board.deleted'));
    }

    public function storeFile(StoreMonitoringBoardFileRequest $request, MonitoringBoardItem $item)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());
        $this->monitoringBoardService->storeFile($item, $request->file('file'), (int) $request->user()->id);

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', __('messages.monitoring_board.file_uploaded'));
    }

    public function destroyFile(Request $request, MonitoringBoardFile $file)
    {
        $this->monitoringBoardService->ensureAuthorized($request->user());
        $this->monitoringBoardService->deleteFile($file);

        return redirect()
            ->route('monitoring-board.index')
            ->with('success', __('messages.monitoring_board.file_deleted'));
    }
}
