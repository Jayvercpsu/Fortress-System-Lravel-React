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
            ->route('projects.show', ['project' => $project->id])
            ->with('success', 'Project update added.');
    }

    private function authorizeRole(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);
    }
}
