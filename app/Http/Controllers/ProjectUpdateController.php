<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectUpdate;
use Illuminate\Http\Request;

class ProjectUpdateController extends Controller
{
    public function index(Request $request, Project $project)
    {
        $this->authorizeRole($request);

        return response()->json([
            'updates' => $project->updates()->latest()->get(),
        ]);
    }

    public function store(Request $request, Project $project)
    {
        $this->authorizeRole($request);

        $validated = $request->validate([
            'note' => 'required|string|max:2000',
        ]);

        ProjectUpdate::create([
            'project_id' => $project->id,
            'note' => $validated['note'],
            'created_by' => $request->user()->id,
        ]);

        return redirect()
            ->route('projects.show', [
                'project' => $project->id,
                ...$this->projectShowQueryParams($request),
            ])
            ->with('success', 'Project update added.');
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
