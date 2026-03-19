<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectFiles\StoreProjectFileRequest;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Services\ProjectFileService;
use Illuminate\Http\Request;

class ProjectFileController extends Controller
{
    public function __construct(
        private readonly ProjectFileService $projectFileService
    ) {
    }

    public function index(Request $request, Project $project)
    {
        $this->projectFileService->ensureAuthorized($request->user());

        return response()->json($this->projectFileService->filesPayload($project));
    }

    public function store(StoreProjectFileRequest $request, Project $project)
    {
        $this->projectFileService->ensureAuthorized($request->user());
        $this->projectFileService->createFile($project, $request->file('file'), (int) $request->user()->id);

        return redirect()
            ->route('projects.show', [
                'project' => $project->id,
                ...$this->projectFileService->projectShowQueryParams($request),
            ])
            ->with('success', __('messages.project_files.created'));
    }

    public function destroy(Request $request, ProjectFile $projectFile)
    {
        $this->projectFileService->ensureAuthorized($request->user());

        $projectId = $projectFile->project_id;
        $this->projectFileService->deleteFile($projectFile);

        return redirect()
            ->route('projects.show', [
                'project' => $projectId,
                ...$this->projectFileService->projectShowQueryParams($request),
            ])
            ->with('success', __('messages.project_files.deleted'));
    }
}
