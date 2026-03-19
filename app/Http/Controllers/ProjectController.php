<?php

namespace App\Http\Controllers;

use App\Http\Requests\Projects\StoreProjectRequest;
use App\Http\Requests\Projects\UpdateAssignedForemenRequest;
use App\Http\Requests\Projects\UpdateProjectFinancialsRequest;
use App\Http\Requests\Projects\UpdateProjectPhaseRequest;
use App\Http\Requests\Projects\UpdateProjectRequest;
use App\Models\Project;
use App\Models\ProjectWorker;
use App\Models\User;
use App\Services\ProjectService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProjectController extends Controller
{
    public function __construct(
        private readonly ProjectService $projectService
    ) {
    }

    public function index(Request $request)
    {
        $payload = $this->projectService->indexPayload($request);

        return Inertia::render($payload['page'], $payload['props']);
    }

    public function create(Request $request)
    {
        abort_unless($request->user()->role === User::ROLE_HEAD_ADMIN, 403);

        return Inertia::render('HeadAdmin/Projects/Create', [
            'foremen' => $this->projectService->foremanOptionsPayload(),
            'clientOptions' => $this->projectService->clientOptionsPayload(),
        ]);
    }

    public function store(StoreProjectRequest $request)
    {
        abort_unless($request->user()->role === User::ROLE_HEAD_ADMIN, 403);

        $project = $this->projectService->storeProject($request->validated());

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', __('messages.projects.created'));
    }

    public function show(Request $request, Project $project)
    {
        $payload = $this->projectService->showPayload($request, $project);

        return Inertia::render($payload['page'], $payload['props']);
    }

    public function edit(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, User::manageableRoles(), true), 403);

        $payload = $this->projectService->editPayload($project);

        return Inertia::render($payload['page'], $payload['props']);
    }

    public function update(UpdateProjectRequest $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, User::manageableRoles(), true), 403);

        $this->projectService->updateProject($project, $request->validated());

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', __('messages.projects.updated'));
    }

    public function projectReceipt(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, User::manageableRoles(), true), 403);

        $token = $this->projectService->resolveProjectReceiptToken($project);

        return redirect()->route('public.progress-receipt', ['token' => $token]);
    }

    public function updatePhase(UpdateProjectPhaseRequest $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, User::manageableRoles(), true), 403);

        $this->projectService->updateProjectPhase($project, (string) $request->validated('phase'));

        return redirect()
            ->route('projects.index', $this->projectService->projectIndexQueryParams($request))
            ->with('success', __('messages.projects.phase_updated'));
    }

    public function transferToConstruction(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, User::manageableRoles(), true), 403);

        $this->projectService->transferToConstruction($project);

        return redirect()
            ->route('projects.index', $this->projectService->projectIndexQueryParams($request))
            ->with('success', __('messages.projects.transferred_to_construction'));
    }

    public function transferToCompleted(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, User::manageableRoles(), true), 403);

        $this->projectService->transferToCompleted($project);

        return redirect()
            ->route('projects.index', $this->projectService->projectIndexQueryParams($request))
            ->with('success', __('messages.projects.transferred_to_completed'));
    }

    public function updateAssignedForemen(UpdateAssignedForemenRequest $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, User::manageableRoles(), true), 403);

        $error = $this->projectService->updateAssignedForemen(
            $project,
            $request->validated('foreman_names', [])
        );

        if ($error !== null) {
            return back()->withErrors([
                'foreman_names' => $error,
            ]);
        }

        return redirect()
            ->route('projects.show', ['project' => $project->id] + $this->projectService->projectShowQueryParams($request))
            ->with('success', __('messages.projects.assigned_foremen_updated'));
    }

    public function destroy(Request $request, Project $project)
    {
        abort_unless($request->user()->role === User::ROLE_HEAD_ADMIN, 403);

        $this->projectService->destroyProject($project);

        return redirect()
            ->route('projects.index', $this->projectService->projectIndexQueryParams($request))
            ->with('success', __('messages.projects.deleted'));
    }

    public function editFinancials(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_HEAD_ADMIN, User::ROLE_ADMIN, User::ROLE_HR], true), 403);

        $payload = $this->projectService->editFinancialsPayload($request, $project);

        return Inertia::render($payload['page'], $payload['props']);
    }

    public function updateFinancials(UpdateProjectFinancialsRequest $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_HEAD_ADMIN, User::ROLE_ADMIN, User::ROLE_HR], true), 403);

        $this->projectService->updateFinancials($project, $request->validated());

        if ((string) $request->query('return') === 'financials') {
            return redirect()
                ->route('projects.financials.edit', ['project' => $project->id])
                ->with('success', __('messages.projects.financials_updated'));
        }

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', __('messages.projects.financials_updated'));
    }

    public function storeTeamMember(Request $request, Project $project)
    {
        abort(403, __('messages.projects.team_read_only'));
    }

    public function destroyTeamMember(Request $request, ProjectWorker $projectWorker)
    {
        abort(403, __('messages.projects.team_read_only'));
    }
}
