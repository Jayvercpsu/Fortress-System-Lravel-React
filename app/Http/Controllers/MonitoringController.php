<?php

namespace App\Http\Controllers;

use App\Http\Requests\Monitoring\BulkDestroyProjectScopeRequest;
use App\Http\Requests\Monitoring\StoreProjectScopeRequest;
use App\Http\Requests\Monitoring\UpdateProjectScopeRequest;
use App\Http\Requests\Monitoring\ReorderProjectScopesRequest;
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

    /**
     * Stay on the build tracker when the request came from there;
     * otherwise fall back to the monitoring page.
     */
    private function scopeRedirect(Request $request, int $projectId)
    {
        if (str_contains((string) $request->headers->get('referer'), '/build')) {
            return redirect()->route('build.show', ['project' => $projectId]);
        }

        return redirect()->route('monitoring.show', ['project' => $projectId]);
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
        $this->monitoringService->createScope($project, $request->validated(), (int) $request->user()->id);

        return $this->scopeRedirect($request, (int) $project->id)
            ->with('success', __('messages.monitoring.scope_created'));
    }

    public function update(UpdateProjectScopeRequest $request, ProjectScope $scope)
    {
        $this->monitoringService->ensureAuthorized($request->user());
        $this->monitoringService->updateScope($scope, $request->validated(), (int) $request->user()->id);

        return $this->scopeRedirect($request, (int) $scope->project_id)
            ->with('success', __('messages.monitoring.scope_updated'));
    }

    public function bulkDestroy(BulkDestroyProjectScopeRequest $request, Project $project)
    {
        $this->monitoringService->ensureAuthorized($request->user());
        $this->monitoringService->deleteScopes($project, $request->validated('ids'));

        return back()->with('success', __('messages.monitoring.scopes_bulk_deleted'));
    }

    public function destroy(Request $request, ProjectScope $scope)
    {
        $this->monitoringService->ensureAuthorized($request->user());
        $projectId = (int) $scope->project_id;
        $this->monitoringService->deleteScope($scope);

        return $this->scopeRedirect($request, $projectId)
            ->with('success', __('messages.monitoring.scope_deleted'));
    }

    public function reorder(ReorderProjectScopesRequest $request, Project $project)
    {
        $this->monitoringService->ensureAuthorized($request->user());
        $this->monitoringService->reorderScopes($project, $request->validated()['scope_ids']);

        return back()->with('success', __('messages.monitoring.scope_reordered'));
    }
}
