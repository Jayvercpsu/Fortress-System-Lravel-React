<?php

namespace App\Http\Controllers;

use App\Http\Requests\HrWorkers\StoreHrWorkerRequest;
use App\Http\Requests\HrWorkers\UpdateHrWorkerRequest;
use App\Models\Worker;
use App\Services\HrWorkerService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class HrWorkerController extends Controller
{
    public function __construct(
        private readonly HrWorkerService $hrWorkerService
    ) {
    }

    public function index(Request $request)
    {
        return Inertia::render('HR/Workers/Index', $this->hrWorkerService->indexPayload($request));
    }

    public function store(StoreHrWorkerRequest $request)
    {
        $this->hrWorkerService->createWorker($request->user(), $request->validated());

        return redirect()
            ->route('hr.workers.index', $this->hrWorkerService->tableQueryParams($request))
            ->with('success', __('messages.foreman_workers.created'));
    }

    public function update(UpdateHrWorkerRequest $request, Worker $worker)
    {
        $this->hrWorkerService->updateWorker($request->user(), $worker, $request->validated());

        return redirect()
            ->route('hr.workers.index', $this->hrWorkerService->tableQueryParams($request))
            ->with('success', __('messages.foreman_workers.updated'));
    }

    public function destroy(Request $request, Worker $worker)
    {
        $this->hrWorkerService->deleteWorker($request->user(), $worker);

        return redirect()
            ->route('hr.workers.index', $this->hrWorkerService->tableQueryParams($request))
            ->with('success', __('messages.foreman_workers.deleted'));
    }
}
