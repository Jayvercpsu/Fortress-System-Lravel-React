<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProjectFileController extends Controller
{
    public function index(Request $request, Project $project)
    {
        $this->authorizeRole($request);

        return response()->json([
            'files' => $project->files()->latest()->get(),
        ]);
    }

    public function store(Request $request, Project $project)
    {
        $this->authorizeRole($request);

        $validated = $request->validate([
            'file' => 'required|file|max:20480',
        ]);

        $uploaded = $validated['file'];
        $path = $uploaded->store('project-files/' . $project->id, 'public');

        ProjectFile::create([
            'project_id' => $project->id,
            'file_path' => $path,
            'original_name' => $uploaded->getClientOriginalName(),
            'uploaded_by' => $request->user()->id,
        ]);

        return redirect()
            ->route('projects.show', [
                'project' => $project->id,
                ...$this->projectShowQueryParams($request),
            ])
            ->with('success', 'Project file uploaded.');
    }

    public function destroy(Request $request, ProjectFile $projectFile)
    {
        $this->authorizeRole($request);

        if ($projectFile->file_path) {
            Storage::disk('public')->delete($projectFile->file_path);
        }

        $projectId = $projectFile->project_id;
        $projectFile->delete();

        return redirect()
            ->route('projects.show', [
                'project' => $projectId,
                ...$this->projectShowQueryParams($request),
            ])
            ->with('success', 'Project file deleted.');
    }

    private function authorizeRole(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);
    }

    private function projectShowQueryParams(Request $request): array
    {
        return array_filter([
            'tab' => $request->query('tab'),
            'files_search' => $request->query('files_search'),
            'files_per_page' => $request->query('files_per_page'),
            'files_page' => $request->query('files_page'),
            'updates_search' => $request->query('updates_search'),
            'updates_per_page' => $request->query('updates_per_page'),
            'updates_page' => $request->query('updates_page'),
        ], fn ($value) => $value !== null && $value !== '');
    }
}
