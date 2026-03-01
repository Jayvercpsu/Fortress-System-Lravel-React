<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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
                'contract_amount' => (float) ($scope->contract_amount ?? 0),
                'weight_percent' => (float) ($scope->weight_percent ?? 0),
                'start_date' => optional($scope->start_date)?->toDateString(),
                'target_completion' => optional($scope->target_completion)?->toDateString(),
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
            'foreman_options' => $this->projectForemanOptions($project),
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
            'contract_amount' => ['required', 'numeric', 'min:0'],
            'weight_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'target_completion' => ['nullable', 'date'],
        ]);
    }

    private function recomputeOverallProgress(Project $project): void
    {
        $latestWeekStart = WeeklyAccomplishment::query()
            ->where('project_id', $project->id)
            ->max('week_start');

        if ($latestWeekStart) {
            $averageProgress = (float) (WeeklyAccomplishment::query()
                ->where('project_id', $project->id)
                ->whereDate('week_start', $latestWeekStart)
                ->avg('percent_completed') ?? 0);
        } else {
            $averageProgress = (float) ($project->scopes()->avg('progress_percent') ?? 0);
        }

        $overallProgress = (int) round(max(0, min(100, $averageProgress)));

        $project->overall_progress = $overallProgress;
        $project->save();
    }

    private function projectForemanOptions(Project $project): array
    {
        $assignedForemanIds = ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->where('role_in_project', 'foreman')
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $assignedForemen = User::query()
            ->where('role', 'foreman')
            ->when(
                $assignedForemanIds->isNotEmpty(),
                fn ($query) => $query->whereIn('id', $assignedForemanIds->all()),
                fn ($query) => $query->whereRaw('1 = 0')
            )
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $user) => [
                'id' => (int) $user->id,
                'fullname' => trim((string) ($user->fullname ?? '')),
            ])
            ->filter(fn (array $row) => $row['fullname'] !== '')
            ->values();

        if ($assignedForemen->isNotEmpty()) {
            return $assignedForemen->all();
        }

        $legacyAssignedNames = collect(preg_split('/[,;]+/', (string) ($project->assigned ?? '')))
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->unique(fn (string $name) => Str::lower($name))
            ->values();

        if ($legacyAssignedNames->isNotEmpty()) {
            $legacyForemen = User::query()
                ->where('role', 'foreman')
                ->whereIn('fullname', $legacyAssignedNames->all())
                ->orderBy('fullname')
                ->get(['id', 'fullname'])
                ->map(fn (User $user) => [
                    'id' => (int) $user->id,
                    'fullname' => trim((string) ($user->fullname ?? '')),
                ])
                ->filter(fn (array $row) => $row['fullname'] !== '')
                ->values();

            if ($legacyForemen->isNotEmpty()) {
                return $legacyForemen->all();
            }
        }

        return User::query()
            ->where('role', 'foreman')
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $user) => [
                'id' => (int) $user->id,
                'fullname' => trim((string) ($user->fullname ?? '')),
            ])
            ->filter(fn (array $row) => $row['fullname'] !== '')
            ->values()
            ->all();
    }
}
