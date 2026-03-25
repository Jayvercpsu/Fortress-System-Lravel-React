<?php

namespace App\Http\Controllers;

use App\Http\Requests\ForemanWorkers\StoreWorkerRequest;
use App\Http\Requests\ForemanWorkers\UpdateWorkerRequest;
use App\Models\Worker;
use App\Models\User;
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
        abort_unless(in_array($request->user()->role, [User::ROLE_HR, User::ROLE_HEAD_ADMIN], true), 403);
        $this->foremanWorkerService->createWorker($request->user(), $request->validated());

        return redirect()
            ->route('foreman.workers.index', $this->foremanWorkerService->tableQueryParams($request))
            ->with('success', __('messages.foreman_workers.created'));
    }

    public function update(UpdateWorkerRequest $request, Worker $worker)
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_HR, User::ROLE_HEAD_ADMIN], true), 403);
        $this->foremanWorkerService->updateWorker($request->user(), $worker, $request->validated());

        return redirect()
            ->route('foreman.workers.index', $this->foremanWorkerService->tableQueryParams($request))
            ->with('success', __('messages.foreman_workers.updated'));
    }

    public function destroy(Request $request, Worker $worker)
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_HR, User::ROLE_HEAD_ADMIN], true), 403);
        $this->foremanWorkerService->deleteWorker($request->user(), $worker);

        return redirect()
            ->route('foreman.workers.index', $this->foremanWorkerService->tableQueryParams($request))
            ->with('success', __('messages.foreman_workers.deleted'));
    }
}
