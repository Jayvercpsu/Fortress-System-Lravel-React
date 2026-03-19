<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectUpdates\StoreProjectUpdateRequest;
use App\Models\Project;
use App\Models\ProjectUpdate;
use App\Services\ProjectUpdateService;
use Illuminate\Http\Request;

class ProjectUpdateController extends Controller
{
    public function __construct(
        private readonly ProjectUpdateService $projectUpdateService
    ) {
    }

    public function index(Request $request, Project $project)
    {
        $this->projectUpdateService->ensureAuthorized($request->user());

        return response()->json($this->projectUpdateService->updatesPayload($project));
    }

    public function store(StoreProjectUpdateRequest $request, Project $project)
    {
        $this->projectUpdateService->ensureAuthorized($request->user());
        $this->projectUpdateService->createUpdate($project, (int) $request->user()->id, (string) $request->validated('note'));

        return redirect()
            ->route('projects.show', [
                'project' => $project->id,
                ...$this->projectUpdateService->projectShowQueryParams($request),
            ])
            ->with('success', __('messages.project_updates.created'));
    }

    public function destroy(Request $request, ProjectUpdate $projectUpdate)
    {
        $this->projectUpdateService->ensureAuthorized($request->user());

        $projectId = $projectUpdate->project_id;
        $this->projectUpdateService->deleteUpdate($projectUpdate);

        return redirect()
            ->route('projects.show', [
                'project' => $projectId,
                ...$this->projectUpdateService->projectShowQueryParams($request),
                'tab' => 'updates',
            ])
            ->with('success', __('messages.project_updates.deleted'));
    }
}
