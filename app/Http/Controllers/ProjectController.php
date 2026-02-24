<?php

namespace App\Http\Controllers;

use App\Models\BuildProject;
use App\Models\DesignProject;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectWorker;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $allowedPerPage = [5, 10, 25, 50];
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $query = Project::query();

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('client', 'like', "%{$search}%")
                    ->orWhere('phase', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%")
                    ->orWhere('assigned', 'like', "%{$search}%");
            });
        }

        $paginator = $query
            ->latest()
            ->paginate($perPage)
            ->withQueryString();

        $projects = collect($paginator->items())->map(function (Project $project) {
            $computed = $this->computedTrackerMetrics($project);

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
                'overall_progress' => $computed['overall_progress'],
                'contract_amount' => $computed['contract_amount'],
                'total_client_payment' => $computed['total_client_payment'],
                'remaining_balance' => $computed['remaining_balance'],
            ];
        })->values();

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Projects/Index'
            : 'Admin/Projects/Index';

        return Inertia::render($page, [
            'projects' => $projects,
            'projectTable' => [
                'search' => $search,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function create(Request $request)
    {
        abort_unless($request->user()->role === 'head_admin', 403);

        return Inertia::render('HeadAdmin/Projects/Create', [
            'foremen' => User::query()
                ->where('role', 'foreman')
                ->orderBy('fullname')
                ->get(['id', 'fullname'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'fullname' => $user->fullname,
                ])
                ->values(),
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->role === 'head_admin', 403);

        $validated = $request->validate($this->projectRules());
        $validated['overall_progress'] = 0;
        $project = Project::create($validated);
        $this->syncLegacyForemanAssignments($project);

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', 'Project created.');
    }

    public function show(Request $request, Project $project)
    {
        $payload = $this->projectPayload($project);
        $allowedPerPage = [5, 10, 25, 50];

        $filesSearch = trim((string) $request->query('files_search', ''));
        $filesPerPage = (int) $request->query('files_per_page', 5);
        if (!in_array($filesPerPage, $allowedPerPage, true)) {
            $filesPerPage = 5;
        }

        $filesQuery = $project->files()->with('uploader:id,fullname');
        if ($filesSearch !== '') {
            $filesQuery->where(function ($query) use ($filesSearch) {
                $query
                    ->where('original_name', 'like', "%{$filesSearch}%")
                    ->orWhereHas('uploader', fn ($uploader) => $uploader->where('fullname', 'like', "%{$filesSearch}%"));
            });
        }

        $filesPaginator = $filesQuery
            ->latest()
            ->paginate($filesPerPage, ['*'], 'files_page')
            ->withQueryString();

        $files = collect($filesPaginator->items())
            ->map(fn ($file) => [
                'id' => $file->id,
                'file_path' => $file->file_path,
                'original_name' => $file->original_name,
                'uploaded_by' => $file->uploaded_by,
                'uploaded_by_name' => $file->uploader?->fullname,
                'created_at' => optional($file->created_at)?->toDateTimeString(),
            ])
            ->values();

        $updatesSearch = trim((string) $request->query('updates_search', ''));
        $updatesPerPage = (int) $request->query('updates_per_page', 5);
        if (!in_array($updatesPerPage, $allowedPerPage, true)) {
            $updatesPerPage = 5;
        }

        $updatesQuery = $project->updates()->with('creator:id,fullname');
        if ($updatesSearch !== '') {
            $updatesQuery->where(function ($query) use ($updatesSearch) {
                $query
                    ->where('note', 'like', "%{$updatesSearch}%")
                    ->orWhereHas('creator', fn ($creator) => $creator->where('fullname', 'like', "%{$updatesSearch}%"));
            });
        }

        $updatesPaginator = $updatesQuery
            ->latest()
            ->paginate($updatesPerPage, ['*'], 'updates_page')
            ->withQueryString();

        $updates = collect($updatesPaginator->items())
            ->map(fn ($update) => [
                'id' => $update->id,
                'note' => $update->note,
                'created_by' => $update->created_by,
                'created_by_name' => $update->creator?->fullname,
                'created_at' => optional($update->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Projects/Show'
            : 'Admin/Projects/Show';

        return Inertia::render($page, [
            'project' => $payload,
            'assignedTeam' => $this->projectTeamPayload($project),
            'teamOptions' => $this->projectTeamOptions(),
            'files' => $files,
            'fileTable' => [
                'search' => $filesSearch,
                'per_page' => $filesPaginator->perPage(),
                'current_page' => $filesPaginator->currentPage(),
                'last_page' => max(1, $filesPaginator->lastPage()),
                'total' => $filesPaginator->total(),
                'from' => $filesPaginator->firstItem(),
                'to' => $filesPaginator->lastItem(),
            ],
            'updates' => $updates,
            'updateTable' => [
                'search' => $updatesSearch,
                'per_page' => $updatesPaginator->perPage(),
                'current_page' => $updatesPaginator->currentPage(),
                'last_page' => max(1, $updatesPaginator->lastPage()),
                'total' => $updatesPaginator->total(),
                'from' => $updatesPaginator->firstItem(),
                'to' => $updatesPaginator->lastItem(),
            ],
        ]);
    }

    public function edit(Request $request, Project $project)
    {
        abort_unless($request->user()->role === 'head_admin', 403);

        return Inertia::render('HeadAdmin/Projects/Edit', [
            'project' => $this->projectPayload($project),
            'foremen' => User::query()
                ->where('role', 'foreman')
                ->orderBy('fullname')
                ->get(['id', 'fullname'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'fullname' => $user->fullname,
                ])
                ->values(),
        ]);
    }

    public function update(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate($this->projectRules());
        $project->update($validated);
        $this->syncLegacyForemanAssignments($project->fresh());

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', 'Project updated.');
    }

    public function destroy(Request $request, Project $project)
    {
        abort_unless($request->user()->role === 'head_admin', 403);

        $projectId = (string) $project->id;
        $filePaths = $project->files()->pluck('file_path')->filter()->values()->all();

        DB::transaction(function () use ($project, $projectId) {
            DesignProject::where('project_id', $projectId)->delete();
            BuildProject::where('project_id', $projectId)->delete();
            Expense::where('project_id', $projectId)->delete();
            $project->files()->delete();
            $project->updates()->delete();
            $project->delete();
        });

        foreach ($filePaths as $filePath) {
            Storage::disk('public')->delete($filePath);
        }
        Storage::disk('public')->deleteDirectory('project-files/' . $projectId);

        $query = array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');

        return redirect()
            ->route('projects.index', $query)
            ->with('success', 'Project deleted.');
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
        $project->update([
            'remaining_balance' => (float) $validated['contract_amount'] - (float) $validated['total_client_payment'],
        ]);

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', 'Project financials updated.');
    }

    public function storeTeamMember(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate([
            'user_id' => ['nullable', 'exists:users,id'],
            'worker_name' => ['nullable', 'string', 'max:255'],
            'rate' => ['nullable', 'numeric', 'min:0'],
        ]);

        $userId = $validated['user_id'] ?? null;
        $workerName = trim((string) ($validated['worker_name'] ?? ''));

        if (!$userId && $workerName === '') {
            return back()->withErrors([
                'team_member' => 'Select a user or enter a worker name.',
            ]);
        }

        if ($userId) {
            $workerName = '';
        }

        $resolvedRate = $validated['rate'] ?? null;

        if ($resolvedRate === null) {
            if ($userId) {
                $resolvedRate = User::query()->whereKey($userId)->value('default_rate_per_hour') ?? 0;
            } else {
                $resolvedRate = Worker::query()
                    ->where('name', $workerName)
                    ->whereNotNull('default_rate_per_hour')
                    ->orderByDesc('id')
                    ->value('default_rate_per_hour') ?? 0;
            }
        }

        $teamMember = ProjectWorker::query()
            ->where('project_id', $project->id)
            ->when(
                $userId,
                fn ($query) => $query->where('user_id', $userId),
                fn ($query) => $query->whereNull('user_id')->where('worker_name', $workerName)
            )
            ->first();

        if ($teamMember) {
            $teamMember->update([
                'rate' => round((float) $resolvedRate, 2),
                'worker_name' => $userId ? null : $workerName,
            ]);
        } else {
            ProjectWorker::create([
                'project_id' => $project->id,
                'user_id' => $userId ?: null,
                'worker_name' => $userId ? null : $workerName,
                'rate' => round((float) $resolvedRate, 2),
            ]);
        }

        return redirect()
            ->route('projects.show', ['project' => $project->id] + $this->projectShowQueryParams($request))
            ->with('success', 'Assigned team updated.');
    }

    public function destroyTeamMember(Request $request, ProjectWorker $projectWorker)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $projectId = $projectWorker->project_id;
        $projectWorker->delete();

        return redirect()
            ->route('projects.show', ['project' => $projectId] + $this->projectShowQueryParams($request))
            ->with('success', 'Team member removed.');
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
            'overall_progress' => 'prohibited',
            'contract_amount' => 'prohibited',
            'design_fee' => 'prohibited',
            'construction_cost' => 'prohibited',
            'total_client_payment' => 'prohibited',
        ];
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

    private function projectPayload(Project $project): array
    {
        $computed = $this->computedTrackerMetrics($project);

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
            'overall_progress' => $computed['overall_progress'],
            'contract_amount' => $computed['contract_amount'],
            'design_fee' => $computed['design_fee'],
            'construction_cost' => $computed['construction_cost'],
            'total_client_payment' => $computed['total_client_payment'],
            'remaining_balance' => $computed['remaining_balance'],
            'last_paid_date' => $computed['last_paid_date'],
        ];
    }

    private function projectTeamPayload(Project $project): array
    {
        return $project->teamMembers()
            ->with('user:id,fullname,role')
            ->orderByRaw('CASE WHEN user_id IS NULL THEN 1 ELSE 0 END')
            ->orderBy('worker_name')
            ->orderBy('id')
            ->get()
            ->map(fn (ProjectWorker $teamMember) => [
                'id' => $teamMember->id,
                'project_id' => $teamMember->project_id,
                'user_id' => $teamMember->user_id,
                'worker_name' => $teamMember->worker_name,
                'display_name' => $teamMember->user?->fullname ?: $teamMember->worker_name,
                'source' => $teamMember->user_id ? 'user' : 'manual',
                'user_role' => $teamMember->user?->role,
                'rate' => (float) $teamMember->rate,
            ])
            ->values()
            ->all();
    }

    private function projectTeamOptions(): array
    {
        return [
            'users' => User::query()
                ->whereIn('role', ['foreman', 'admin', 'hr'])
                ->orderBy('fullname')
                ->get(['id', 'fullname', 'role', 'default_rate_per_hour'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'fullname' => $user->fullname,
                    'role' => $user->role,
                    'default_rate_per_hour' => $user->default_rate_per_hour !== null ? (float) $user->default_rate_per_hour : null,
                ])
                ->values()
                ->all(),
            'workers' => Worker::query()
                ->orderBy('name')
                ->get(['id', 'name', 'default_rate_per_hour'])
                ->map(fn (Worker $worker) => [
                    'id' => $worker->id,
                    'name' => $worker->name,
                    'default_rate_per_hour' => $worker->default_rate_per_hour !== null ? (float) $worker->default_rate_per_hour : null,
                ])
                ->values()
                ->all(),
        ];
    }

    private function computedTrackerMetrics(Project $project): array
    {
        $projectId = (string) $project->id;
        $design = DesignProject::where('project_id', $projectId)->first();
        $build = BuildProject::where('project_id', $projectId)->first();

        $designContractAmount = (float) ($design?->design_contract_amount ?? 0);

        $constructionContract = (float) ($build?->construction_contract ?? 0);
        $expenseConstructionCost = (float) Expense::where('project_id', $projectId)->sum('amount');
        $constructionCost = $expenseConstructionCost;
        $overallProgress = (int) max(0, min(100, (int) $project->overall_progress));

        $contractAmount = $designContractAmount + $constructionContract;
        $totalClientPayment = (float) Payment::where('project_id', $projectId)->sum('amount');
        $lastPaidDate = Payment::where('project_id', $projectId)->max('date_paid');
        $remainingBalance = $contractAmount - $totalClientPayment;

        $computed = [
            'contract_amount' => $contractAmount,
            'design_fee' => $designContractAmount,
            'construction_cost' => $constructionCost,
            'total_client_payment' => $totalClientPayment,
            'remaining_balance' => $remainingBalance,
            'last_paid_date' => $lastPaidDate,
            'overall_progress' => $overallProgress,
        ];

        // Keep project financial snapshot columns aligned with tracker-derived values.
        Project::whereKey($project->id)->update([
            'contract_amount' => $computed['contract_amount'],
            'design_fee' => $computed['design_fee'],
            'construction_cost' => $computed['construction_cost'],
            'total_client_payment' => $computed['total_client_payment'],
            'remaining_balance' => $computed['remaining_balance'],
            'last_paid_date' => $computed['last_paid_date'],
        ]);

        return $computed;
    }

    private function syncLegacyForemanAssignments(Project $project): void
    {
        $assignedNames = collect(preg_split('/[,;]+/', (string) ($project->assigned ?? '')))
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->values();

        $foremanIds = User::query()
            ->where('role', 'foreman')
            ->whereIn('fullname', $assignedNames->all())
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($assignedNames->isEmpty()) {
            ProjectAssignment::query()
                ->where('project_id', $project->id)
                ->whereIn('user_id', User::query()->where('role', 'foreman')->pluck('id'))
                ->delete();

            return;
        }

        $existingForemanIds = User::query()->where('role', 'foreman')->pluck('id');

        ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->whereIn('user_id', $existingForemanIds)
            ->whereNotIn('user_id', $foremanIds->all())
            ->delete();

        foreach ($foremanIds as $foremanId) {
            ProjectAssignment::query()->updateOrCreate(
                [
                    'project_id' => $project->id,
                    'user_id' => $foremanId,
                ],
                [
                    'role_in_project' => 'foreman',
                ]
            );
        }
    }
}
