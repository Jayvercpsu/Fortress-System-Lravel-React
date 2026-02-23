<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectScope;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MonitoringController extends Controller
{
    public function show(Request $request, Project $project)
    {
        $this->ensureAuthorized($request);

        $scopes = $project->scopes()
            ->with(['photos' => fn ($query) => $query->latest('id')])
            ->latest('id')
            ->get()
            ->map(fn (ProjectScope $scope) => [
                'id' => $scope->id,
                'project_id' => $scope->project_id,
                'scope_name' => $scope->scope_name,
                'assigned_personnel' => $scope->assigned_personnel,
                'progress_percent' => (int) $scope->progress_percent,
                'status' => $scope->status,
                'remarks' => $scope->remarks,
                'updated_at' => optional($scope->updated_at)?->toDateTimeString(),
                'photos' => $scope->photos->map(fn ($photo) => [
                    'id' => $photo->id,
                    'photo_path' => $photo->photo_path,
                    'caption' => $photo->caption,
                    'created_at' => optional($photo->created_at)?->toDateTimeString(),
                ])->values(),
            ])
            ->values();

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Monitoring/Show'
            : 'Admin/Monitoring/Show';

        return Inertia::render($page, [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'overall_progress' => (int) $project->overall_progress,
                'status' => $project->status,
            ],
            'scopes' => $scopes,
        ]);
    }

    public function store(Request $request, Project $project)
    {
        $this->ensureAuthorized($request);

        $project->scopes()->create($this->validatedScope($request));
        $this->recomputeOverallProgress($project);

        return redirect()
            ->route('monitoring.show', ['project' => $project->id])
            ->with('success', 'Scope added.');
    }

    public function update(Request $request, ProjectScope $scope)
    {
        $this->ensureAuthorized($request);

        $scope->update($this->validatedScope($request));
        $this->recomputeOverallProgress($scope->project);

        return redirect()
            ->route('monitoring.show', ['project' => $scope->project_id])
            ->with('success', 'Scope updated.');
    }

    public function destroy(Request $request, ProjectScope $scope)
    {
        $this->ensureAuthorized($request);

        $project = $scope->project;
        $scope->delete();
        $this->recomputeOverallProgress($project);

        return redirect()
            ->route('monitoring.show', ['project' => $project->id])
            ->with('success', 'Scope deleted.');
    }

    private function ensureAuthorized(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);
    }

    private function validatedScope(Request $request): array
    {
        return $request->validate([
            'scope_name' => ['required', 'string', 'max:255'],
            'assigned_personnel' => ['nullable', 'string', 'max:255'],
            'progress_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'status' => ['required', 'string', 'max:50'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function recomputeOverallProgress(Project $project): void
    {
        $averageProgress = (float) ($project->scopes()->avg('progress_percent') ?? 0);
        $overallProgress = (int) round(max(0, min(100, $averageProgress)));

        $project->overall_progress = $overallProgress;
        $project->save();
    }
}
