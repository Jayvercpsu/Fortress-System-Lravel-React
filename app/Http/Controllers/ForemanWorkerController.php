<?php

namespace App\Http\Controllers;

use App\Http\Requests\ForemanWorkers\StoreWorkerRequest;
use App\Http\Requests\ForemanWorkers\UpdateWorkerRequest;
use App\Models\Worker;
use App\Services\ForemanWorkerService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ForemanWorkerController extends Controller
{
    public function __construct(
        private readonly ForemanWorkerService $foremanWorkerService
    ) {
    }

    public function index(Request $request)
    {
        return Inertia::render('Foreman/Workers/Index', $this->foremanWorkerService->indexPayload($request));
    }

    public function store(StoreWorkerRequest $request)
    {
        $this->foremanWorkerService->createWorker($request->user(), $request->validated());

        return redirect()
            ->route('foreman.workers.index', $this->foremanWorkerService->tableQueryParams($request))
            ->with('success', __('messages.foreman_workers.created'));
    }

    public function update(UpdateWorkerRequest $request, Worker $worker)
    {
        $this->foremanWorkerService->updateWorker($request->user(), $worker, $request->validated());

        return redirect()
            ->route('foreman.workers.index', $this->foremanWorkerService->tableQueryParams($request))
            ->with('success', __('messages.foreman_workers.updated'));
    }

    public function destroy(Request $request, Worker $worker)
    {
        $this->foremanWorkerService->deleteWorker($request->user(), $worker);

        return redirect()
            ->route('foreman.workers.index', $this->foremanWorkerService->tableQueryParams($request))
            ->with('success', __('messages.foreman_workers.deleted'));
    }
}
