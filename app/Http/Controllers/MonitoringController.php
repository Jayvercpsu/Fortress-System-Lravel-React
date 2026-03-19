<?php

namespace App\Http\Controllers;

use App\Http\Requests\Monitoring\StoreProjectScopeRequest;
use App\Http\Requests\Monitoring\UpdateProjectScopeRequest;
use App\Models\Project;
use App\Models\ProjectScope;
use App\Services\MonitoringService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MonitoringController extends Controller
{
    public function __construct(
        private readonly MonitoringService $monitoringService
    ) {
    }

    public function show(Request $request, Project $project)
    {
        $this->monitoringService->ensureAuthorized($request->user());

        return Inertia::render(
            $this->monitoringService->pageByRole($request->user()),
            $this->monitoringService->showPayload($project)
        );
    }

    public function store(StoreProjectScopeRequest $request, Project $project)
    {
        $this->monitoringService->ensureAuthorized($request->user());
        $this->monitoringService->createScope($project, $request->validated());

        return redirect()
            ->route('monitoring.show', ['project' => $project->id])
            ->with('success', __('messages.monitoring.scope_created'));
    }

    public function update(UpdateProjectScopeRequest $request, ProjectScope $scope)
    {
        $this->monitoringService->ensureAuthorized($request->user());
        $this->monitoringService->updateScope($scope, $request->validated());

        return redirect()
            ->route('monitoring.show', ['project' => $scope->project_id])
            ->with('success', __('messages.monitoring.scope_updated'));
    }

    public function destroy(Request $request, ProjectScope $scope)
    {
        $this->monitoringService->ensureAuthorized($request->user());
        $projectId = (int) $scope->project_id;
        $this->monitoringService->deleteScope($scope);

        return redirect()
            ->route('monitoring.show', ['project' => $projectId])
            ->with('success', __('messages.monitoring.scope_deleted'));
    }
}
