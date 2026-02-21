<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $projects = Project::latest()->get()->map(function (Project $project) {
            return [
                'id' => $project->id,
                'name' => $project->name,
                'client' => $project->client,
                'type' => $project->type,
                'location' => $project->location,
                'assigned' => $project->assigned,
                'target' => optional($project->target)->toDateString(),
                'status' => $project->status,
                'phase' => $project->phase,
                'overall_progress' => $project->overall_progress,
                'contract_amount' => (float) $project->contract_amount,
                'total_client_payment' => (float) $project->total_client_payment,
                'remaining_balance' => (float) $project->contract_amount - (float) $project->total_client_payment,
            ];
        });

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Projects/Index'
            : 'Admin/Projects/Index';

        return Inertia::render($page, [
            'projects' => $projects,
        ]);
    }

    public function create(Request $request)
    {
        abort_unless($request->user()->role === 'head_admin', 403);

        return Inertia::render('HeadAdmin/Projects/Create');
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->role === 'head_admin', 403);

        $validated = $request->validate($this->projectRules());
        $project = Project::create($validated);

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', 'Project created.');
    }

    public function show(Request $request, Project $project)
    {
        $project->load([
            'files.uploader:id,fullname',
            'updates.creator:id,fullname',
        ]);

        $payload = $this->projectPayload($project);
        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Projects/Show'
            : 'Admin/Projects/Show';

        return Inertia::render($page, [
            'project' => $payload,
            'files' => $project->files->map(fn ($file) => [
                'id' => $file->id,
                'file_path' => $file->file_path,
                'original_name' => $file->original_name,
                'uploaded_by' => $file->uploaded_by,
                'uploaded_by_name' => $file->uploader?->fullname,
                'created_at' => optional($file->created_at)?->toDateTimeString(),
            ])->values(),
            'updates' => $project->updates->map(fn ($update) => [
                'id' => $update->id,
                'note' => $update->note,
                'created_by' => $update->created_by,
                'created_by_name' => $update->creator?->fullname,
                'created_at' => optional($update->created_at)?->toDateTimeString(),
            ])->values(),
        ]);
    }

    public function edit(Request $request, Project $project)
    {
        abort_unless($request->user()->role === 'head_admin', 403);

        return Inertia::render('HeadAdmin/Projects/Edit', [
            'project' => $this->projectPayload($project),
        ]);
    }

    public function update(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate($this->projectRules());
        $project->update($validated);

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', 'Project updated.');
    }

    public function updateFinancials(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'hr'], true), 403);

        $validated = $request->validate([
            'contract_amount' => 'required|numeric|min:0',
            'design_fee' => 'required|numeric|min:0',
            'construction_cost' => 'required|numeric|min:0',
            'total_client_payment' => 'required|numeric|min:0',
        ]);

        $project->update($validated);

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', 'Project financials updated.');
    }

    private function projectRules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'client' => 'required|string|max:255',
            'type' => 'required|string|max:100',
            'location' => 'required|string|max:255',
            'assigned' => 'nullable|string|max:255',
            'target' => 'nullable|date',
            'status' => 'required|string|max:50',
            'phase' => 'required|string|max:50',
            'overall_progress' => 'required|integer|min:0|max:100',
            'contract_amount' => 'prohibited',
            'design_fee' => 'prohibited',
            'construction_cost' => 'prohibited',
            'total_client_payment' => 'prohibited',
        ];
    }

    private function projectPayload(Project $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'client' => $project->client,
            'type' => $project->type,
            'location' => $project->location,
            'assigned' => $project->assigned,
            'target' => optional($project->target)->toDateString(),
            'status' => $project->status,
            'phase' => $project->phase,
            'overall_progress' => $project->overall_progress,
            'contract_amount' => (float) $project->contract_amount,
            'design_fee' => (float) $project->design_fee,
            'construction_cost' => (float) $project->construction_cost,
            'total_client_payment' => (float) $project->total_client_payment,
            'remaining_balance' => (float) $project->contract_amount - (float) $project->total_client_payment,
        ];
    }
}
