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
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ProjectController extends Controller
{
    private const PROJECT_PHASES = [
        'Design',
        'ForBuild',
        'Construction',
        'Turnover',
        'Completed',
    ];

    private const PROJECT_STATUSES = [
        'PLANNING',
        'ACTIVE',
        'ONGOING',
        'ON_HOLD',
        'DELAYED',
        'COMPLETED',
        'CANCELLED',
    ];

    private const PROJECT_ASSIGNED_ROLES = [
        'Architect',
        'Engineer',
        'PM',
    ];

    public function index(Request $request)
    {
        $search = trim((string) $request->query('search', ''));
        $batchSize = 5;

        $searchQuery = Project::query();
        $this->applyProjectSearchFilter($searchQuery, $search);

        $totalMatching = (clone $searchQuery)->count();

        $boardColumns = collect(self::PROJECT_PHASES)->map(function (string $phase) use ($request, $search, $batchSize) {
            $pageParam = $this->projectPhasePageParam($phase);
            $loadedPages = max(1, (int) $request->query($pageParam, 1));
            $visibleLimit = $loadedPages * $batchSize;

            $phaseQuery = Project::query();
            $this->applyProjectSearchFilter($phaseQuery, $search);
            $this->applyProjectPhaseFilter($phaseQuery, $phase);

            $total = (clone $phaseQuery)->count();

            $items = $phaseQuery
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit($visibleLimit)
                ->get()
                ->map(fn (Project $project) => $this->projectIndexCardPayload($project))
                ->values();

            $visibleCount = $items->count();
            $lastPage = max(1, (int) ceil(($total ?: 0) / $batchSize));

            return [
                'key' => strtolower((string) preg_replace('/[^a-z0-9]+/i', '', $phase)),
                'label' => $phase,
                'value' => $phase,
                'page_param' => $pageParam,
                'per_page' => $batchSize,
                'current_page' => min($loadedPages, $lastPage),
                'last_page' => $lastPage,
                'total' => $total,
                'shown' => $visibleCount,
                'remaining' => max(0, $total - $visibleCount),
                'has_more' => $visibleCount < $total,
                'projects' => $items,
            ];
        })->values();

        $projects = $boardColumns
            ->flatMap(fn (array $column) => $column['projects'])
            ->values();

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Projects/Index'
            : 'Admin/Projects/Index';

        return Inertia::render($page, [
            'projects' => $projects,
            'projectBoard' => [
                'search' => $search,
                'phase_order' => self::PROJECT_PHASES,
                'batch_size' => $batchSize,
                'total' => $totalMatching,
                'columns' => $boardColumns,
            ],
            'projectTable' => [
                'search' => $search,
                'per_page' => $batchSize,
                'current_page' => 1,
                'last_page' => 1,
                'total' => $totalMatching,
                'from' => $totalMatching > 0 ? 1 : null,
                'to' => $projects->count() > 0 ? $projects->count() : null,
            ],
        ]);
    }

    public function create(Request $request)
    {
        abort_unless($request->user()->role === 'head_admin', 403);

        return Inertia::render('HeadAdmin/Projects/Create', [
            'foremen' => $this->foremanOptionsPayload(),
        ]);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->role === 'head_admin', 403);

        $validated = $request->validate($this->projectRules());
        $validated['assigned_role'] = $this->normalizeProjectAssignedRoleList($validated['assigned_role'] ?? null);
        $validated['status'] = $this->normalizeProjectStatus($validated['status'] ?? null);
        $validated['phase'] = $this->normalizeProjectPhase($validated['phase'] ?? null);
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
        $teamRows = collect($this->projectTeamPayload($project));

        $teamSearch = trim((string) $request->query('team_search', ''));
        $teamPerPage = (int) $request->query('team_per_page', 5);
        if (!in_array($teamPerPage, $allowedPerPage, true)) {
            $teamPerPage = 5;
        }

        if ($teamSearch !== '') {
            $needle = mb_strtolower($teamSearch);
            $teamRows = $teamRows->filter(function (array $row) use ($needle) {
                return collect([
                    $row['display_name'] ?? null,
                    $row['worker_name'] ?? null,
                    $row['user_role'] ?? null,
                    $row['source'] ?? null,
                    isset($row['user_id']) ? (string) $row['user_id'] : null,
                    isset($row['rate']) ? (string) $row['rate'] : null,
                ])->filter()->contains(function ($value) use ($needle) {
                    return str_contains(mb_strtolower((string) $value), $needle);
                });
            })->values();
        }

        $teamPaginator = $this->paginateCollection(
            $teamRows,
            $teamPerPage,
            'team_page',
            $request
        );

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
            'foremen' => $this->foremanOptionsPayload(),
            'assignedTeam' => $teamPaginator->items(),
            'assignedTeamTable' => [
                'search' => $teamSearch,
                'per_page' => $teamPaginator->perPage(),
                'current_page' => $teamPaginator->currentPage(),
                'last_page' => max(1, $teamPaginator->lastPage()),
                'total' => $teamPaginator->total(),
                'from' => $teamPaginator->firstItem(),
                'to' => $teamPaginator->lastItem(),
            ],
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
            'foremen' => $this->foremanOptionsPayload(),
        ]);
    }

    public function update(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate($this->projectRules());
        $validated['assigned_role'] = $this->normalizeProjectAssignedRoleList($validated['assigned_role'] ?? null);
        $validated['status'] = $this->normalizeProjectStatus($validated['status'] ?? null);
        $validated['phase'] = $this->normalizeProjectPhase($validated['phase'] ?? null);
        $project->update($validated);
        $this->syncLegacyForemanAssignments($project->fresh());

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', 'Project updated.');
    }

    public function updatePhase(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate([
            'phase' => ['required', 'string', 'max:50', Rule::in($this->projectPhaseValidationValues())],
        ]);

        $phase = $this->normalizeProjectPhase($validated['phase']);

        if ($this->normalizeProjectPhase($project->phase) !== $phase) {
            $project->update([
                'phase' => $phase,
            ]);
        }

        return redirect()
            ->route('projects.index', $this->projectIndexQueryParams($request))
            ->with('success', 'Project phase updated.');
    }

    public function updateAssignedForemen(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate([
            'foreman_names' => ['nullable', 'array'],
            'foreman_names.*' => [
                'required',
                'string',
                'max:255',
                Rule::exists('users', 'fullname')->where(fn ($query) => $query->where('role', 'foreman')),
            ],
        ]);

        $foremanNames = collect($validated['foreman_names'] ?? [])
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->unique(fn ($name) => strtolower($name))
            ->values();

        $assigned = $foremanNames->implode(', ');

        if (strlen($assigned) > 255) {
            return back()->withErrors([
                'foreman_names' => 'Assigned foremen list is too long for one project. Reduce the number of names.',
            ]);
        }

        $project->update([
            'assigned' => $assigned !== '' ? $assigned : null,
        ]);

        $this->syncLegacyForemanAssignments($project->fresh());

        return redirect()
            ->route('projects.show', ['project' => $project->id] + $this->projectShowQueryParams($request))
            ->with('success', 'Assigned foremen updated.');
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

        return redirect()
            ->route('projects.index', $this->projectIndexQueryParams($request))
            ->with('success', 'Project deleted.');
    }

    public function editFinancials(Request $request, Project $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'hr'], true), 403);

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Projects/Financials'
            : 'HR/ProjectFinancials';

        return Inertia::render($page, [
            'project' => $this->projectFinancialPayload($project),
        ]);
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

        if ((string) $request->query('return') === 'financials') {
            return redirect()
                ->route('projects.financials.edit', ['project' => $project->id])
                ->with('success', 'Project financials updated.');
        }

        return redirect()
            ->route('projects.show', ['project' => $project->id])
            ->with('success', 'Project financials updated.');
    }

    public function storeTeamMember(Request $request, Project $project)
    {
        abort(403, 'Project team editing is read-only. Foremen manage labor records in the Foreman Workers page.');

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
        abort(403, 'Project team editing is read-only. Foremen manage labor records in the Foreman Workers page.');

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
            'assigned_role' => [
                'nullable',
                'string',
                'max:255',
                function (string $attribute, $value, $fail) {
                    $invalid = $this->invalidProjectAssignedRoles($value);
                    if (!empty($invalid)) {
                        $fail('Assigned must use Architect, Engineer, or PM entries (optionally with names, e.g. Engineer: Juan).');
                    }
                },
            ],
            'assigned' => 'nullable|string|max:255',
            'target' => 'nullable|date',
            'status' => ['required', 'string', 'max:50', Rule::in(self::PROJECT_STATUSES)],
            'phase' => ['required', 'string', 'max:50', Rule::in(self::PROJECT_PHASES)],
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
            'team_search' => $request->query('team_search'),
            'team_per_page' => $request->query('team_per_page'),
            'team_page' => $request->query('team_page'),
            'updates_search' => $request->query('updates_search'),
            'updates_per_page' => $request->query('updates_per_page'),
            'updates_page' => $request->query('updates_page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function projectIndexQueryParams(Request $request): array
    {
        $params = [
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ];

        foreach (self::PROJECT_PHASES as $phase) {
            $pageParam = $this->projectPhasePageParam($phase);
            $params[$pageParam] = $request->query($pageParam);
        }

        return array_filter($params, fn ($value) => $value !== null && $value !== '');
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
            'assigned_role' => $this->normalizeProjectAssignedRoleList($project->assigned_role ?? null),
            'assigned' => $project->assigned,
            'target' => optional($project->target)->toDateString(),
            'status' => $this->normalizeProjectStatus($project->status),
            'phase' => $this->normalizeProjectPhase($project->phase),
            'overall_progress' => $computed['overall_progress'],
            'contract_amount' => $computed['contract_amount'],
            'design_fee' => (float) ($project->design_fee ?? 0),
            'construction_cost' => $computed['construction_cost'],
            'total_client_payment' => $computed['total_client_payment'],
            'remaining_balance' => $computed['remaining_balance'],
            'last_paid_date' => $computed['last_paid_date'],
            'computation_sources' => $computed['computation_sources'] ?? [],
        ];
    }

    private function projectFinancialPayload(Project $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'client' => $project->client,
            'type' => $project->type,
            'location' => $project->location,
            'assigned_role' => $this->normalizeProjectAssignedRoleList($project->assigned_role ?? null),
            'assigned' => $project->assigned,
            'target' => optional($project->target)->toDateString(),
            'status' => $this->normalizeProjectStatus($project->status),
            'phase' => $this->normalizeProjectPhase($project->phase),
            'overall_progress' => (int) ($project->overall_progress ?? 0),
            'contract_amount' => (float) ($project->contract_amount ?? 0),
            'design_fee' => (float) ($project->design_fee ?? 0),
            'construction_cost' => (float) ($project->construction_cost ?? 0),
            'total_client_payment' => (float) ($project->total_client_payment ?? 0),
            'remaining_balance' => (float) ($project->remaining_balance ?? 0),
            'last_paid_date' => optional($project->last_paid_date)->toDateString(),
        ];
    }

    private function projectTeamPayload(Project $project): array
    {
        $projectWorkers = Worker::query()
            ->where('project_id', $project->id)
            ->with('foreman:id,fullname')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        $projectWorkersByName = $projectWorkers
            ->filter(fn (Worker $worker) => trim((string) ($worker->name ?? '')) !== '')
            ->keyBy(fn (Worker $worker) => strtolower(trim((string) $worker->name)));

        $teamMembers = $project->teamMembers()
            ->with('user:id,fullname,role')
            ->orderByRaw('CASE WHEN user_id IS NULL THEN 1 ELSE 0 END')
            ->orderBy('worker_name')
            ->orderBy('id')
            ->get()
            ->map(function (ProjectWorker $teamMember) use ($projectWorkersByName) {
                $matchedWorker = null;

                if (!$teamMember->user_id && trim((string) ($teamMember->worker_name ?? '')) !== '') {
                    $matchedWorker = $projectWorkersByName->get(strtolower(trim((string) $teamMember->worker_name)));
                }

                return [
                    'id' => $teamMember->id,
                    'project_id' => $teamMember->project_id,
                    'user_id' => $teamMember->user_id,
                    'worker_name' => $teamMember->worker_name,
                    'display_name' => $teamMember->user?->fullname ?: $teamMember->worker_name,
                    'source' => $teamMember->user_id ? 'user' : 'manual',
                    'user_role' => $teamMember->user?->role,
                    'rate' => (float) $teamMember->rate,
                    'birth_date' => optional($matchedWorker?->birth_date)?->toDateString(),
                    'place_of_birth' => $matchedWorker?->place_of_birth,
                    'sex' => $matchedWorker?->sex,
                    'civil_status' => $matchedWorker?->civil_status,
                    'phone' => $matchedWorker?->phone,
                    'address' => $matchedWorker?->address,
                    'managed_by_foreman_name' => $matchedWorker?->foreman?->fullname,
                ];
            })
            ->values();

        $existingManualNames = $teamMembers
            ->filter(fn ($row) => empty($row['user_id']) && !empty($row['worker_name']))
            ->map(fn ($row) => strtolower(trim((string) $row['worker_name'])))
            ->filter()
            ->unique()
            ->values();

        $foremanWorkers = $projectWorkers
            ->reject(function (Worker $worker) use ($existingManualNames) {
                $nameKey = strtolower(trim((string) ($worker->name ?? '')));
                return $nameKey !== '' && $existingManualNames->contains($nameKey);
            })
            ->map(fn (Worker $worker) => [
                'id' => 'fw-' . $worker->id,
                'project_id' => $project->id,
                'user_id' => null,
                'worker_name' => $worker->name,
                'display_name' => $worker->name,
                'source' => 'manual',
                'user_role' => null,
                'rate' => (float) ($worker->default_rate_per_hour ?? 0),
                'birth_date' => optional($worker->birth_date)?->toDateString(),
                'place_of_birth' => $worker->place_of_birth,
                'sex' => $worker->sex,
                'civil_status' => $worker->civil_status,
                'phone' => $worker->phone,
                'address' => $worker->address,
                'managed_by_foreman_name' => $worker->foreman?->fullname,
            ]);

        return $teamMembers
            ->concat($foremanWorkers)
            ->values()
            ->all();
    }

    private function paginateCollection(Collection $rows, int $perPage, string $pageName, Request $request): LengthAwarePaginator
    {
        $page = max(1, (int) $request->query($pageName, 1));
        $total = $rows->count();
        $items = $rows->forPage($page, $perPage)->values();

        return (new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'pageName' => $pageName,
            ]
        ))->appends($request->query());
    }

    private function projectIndexCardPayload(Project $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'client' => $project->client,
            'type' => $project->type,
            'location' => $project->location,
            'assigned_role' => $this->normalizeProjectAssignedRoleList($project->assigned_role ?? null),
            'assigned' => $project->assigned,
            'target' => optional($project->target)->toDateString(),
            'status' => $this->normalizeProjectStatus($project->status),
            'phase' => $this->normalizeProjectPhase($project->phase),
            'overall_progress' => (int) ($project->overall_progress ?? 0),
            'contract_amount' => (float) ($project->contract_amount ?? 0),
            'total_client_payment' => (float) ($project->total_client_payment ?? 0),
            'remaining_balance' => (float) ($project->remaining_balance ?? 0),
            'is_new_today' => (bool) optional($project->created_at)->isToday(),
        ];
    }

    private function applyProjectSearchFilter($query, string $search): void
    {
        if ($search === '') {
            return;
        }

        $query->where(function ($builder) use ($search) {
            $builder
                ->where('name', 'like', "%{$search}%")
                ->orWhere('client', 'like', "%{$search}%")
                ->orWhere('phase', 'like', "%{$search}%")
                ->orWhere('status', 'like', "%{$search}%")
                ->orWhere('location', 'like', "%{$search}%")
                ->orWhere('assigned_role', 'like', "%{$search}%")
                ->orWhere('assigned', 'like', "%{$search}%");
        });
    }

    private function applyProjectPhaseFilter($query, string $phase): void
    {
        $query->whereRaw(
            "LOWER(REPLACE(REPLACE(REPLACE(COALESCE(phase, ''), '-', ''), ' ', ''), '_', '')) = ?",
            [$this->projectPhaseMatchKey($phase)]
        );
    }

    private function projectPhasePageParam(string $phase): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', $phase)) . '_page';
    }

    private function projectPhaseValidationValues(): array
    {
        return collect(self::PROJECT_PHASES)
            ->flatMap(fn (string $phase) => [
                $phase,
                strtoupper($phase),
                strtoupper((string) preg_replace('/[^a-z0-9]+/i', '', $phase)),
            ])
            ->unique()
            ->values()
            ->all();
    }

    private function projectPhaseMatchKey(string $phase): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', $this->normalizeProjectPhase($phase)));
    }

    private function normalizeProjectPhase(?string $phase): string
    {
        $key = strtolower((string) preg_replace('/[^a-z0-9]+/i', '', trim((string) $phase)));

        return match ($key) {
            'design' => 'Design',
            'forbuild' => 'ForBuild',
            'construction' => 'Construction',
            'turnover' => 'Turnover',
            'completed' => 'Completed',
            default => 'Design',
        };
    }

    private function normalizeProjectStatus(?string $status): string
    {
        $key = strtoupper((string) preg_replace('/[^a-z0-9]+/i', '_', trim((string) $status)));
        $key = preg_replace('/_+/', '_', $key ?? '');
        $key = trim((string) $key, '_');

        return match ($key) {
            'PLANNING' => 'PLANNING',
            'ACTIVE' => 'ACTIVE',
            'ONGOING', 'IN_PROGRESS', 'INPROGRESS' => 'ONGOING',
            'ON_HOLD', 'ONHOLD', 'HOLD' => 'ON_HOLD',
            'DELAYED' => 'DELAYED',
            'COMPLETED' => 'COMPLETED',
            'CANCELLED', 'CANCELED' => 'CANCELLED',
            default => 'PLANNING',
        };
    }

    private function invalidProjectAssignedRoles($roles): array
    {
        return collect($this->splitProjectAssignedRoleEntries($roles))
            ->filter()
            ->reject(fn ($entry) => $this->parseProjectAssignedRoleEntry($entry) !== null)
            ->values()
            ->all();
    }

    private function normalizeProjectAssignedRoleList($roles): ?string
    {
        $normalized = collect($this->splitProjectAssignedRoleEntries($roles))
            ->map(fn ($entry) => $this->parseProjectAssignedRoleEntry($entry))
            ->filter()
            ->map(fn (array $entry) => $entry['name'] !== null && $entry['name'] !== ''
                ? "{$entry['role']}: {$entry['name']}"
                : $entry['role'])
            ->unique(fn ($entry) => mb_strtolower((string) $entry))
            ->values();

        return $normalized->isEmpty() ? null : $normalized->implode('; ');
    }

    private function splitProjectAssignedRoleEntries($roles): array
    {
        $raw = trim((string) ($roles ?? ''));
        if ($raw === '') {
            return [];
        }

        $pattern = str_contains($raw, ';') ? '/[;]+/' : '/[,]+/';

        return collect(preg_split($pattern, $raw))
            ->map(fn ($entry) => trim((string) $entry))
            ->filter()
            ->values()
            ->all();
    }

    private function parseProjectAssignedRoleEntry(?string $entry): ?array
    {
        $entry = trim((string) $entry);
        if ($entry === '') {
            return null;
        }

        $rolePart = $entry;
        $namePart = null;

        if (preg_match('/^(.+?)\s*(?:[:\-–—])\s*(.+)$/u', $entry, $matches)) {
            $rolePart = trim((string) ($matches[1] ?? ''));
            $namePart = trim((string) ($matches[2] ?? ''));
        }

        $role = $this->normalizeSingleProjectAssignedRole($rolePart);
        if ($role === null) {
            return null;
        }

        return [
            'role' => $role,
            'name' => $namePart !== null && $namePart !== '' ? $namePart : null,
        ];
    }

    private function normalizeSingleProjectAssignedRole(?string $role): ?string
    {
        $key = strtolower((string) preg_replace('/[^a-z0-9]+/i', '', trim((string) $role)));

        return match ($key) {
            '' => null,
            'architect' => 'Architect',
            'engineer' => 'Engineer',
            'pm' => 'PM',
            default => null,
        };
    }

    private function foremanOptionsPayload()
    {
        return User::query()
            ->where('role', 'foreman')
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'fullname' => $user->fullname,
            ])
            ->values();
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
        $manualDesignFee = (float) ($project->design_fee ?? 0);
        $designTotalReceived = (float) ($design?->total_received ?? 0);
        $designDownpayment = (float) ($design?->downpayment ?? 0);
        $designOfficePayrollDeduction = (float) ($design?->office_payroll_deduction ?? 0);
        $designProgress = (int) max(0, min(100, (int) ($design?->design_progress ?? 0)));
        $designRemaining = $designContractAmount - $designTotalReceived;
        $designNetAfterOfficeDeduction = $designTotalReceived - $designOfficePayrollDeduction;
        $designTrackerSharePct = $contractAmount > 0 ? ($designContractAmount / $contractAmount) * 100 : 0;
        $manualDesignFeeSharePct = $contractAmount > 0 ? ($manualDesignFee / $contractAmount) * 100 : 0;
        $buildTrackerClientPayment = (float) ($build?->total_client_payment ?? 0);
        $buildMaterialsCost = (float) ($build?->materials_cost ?? 0);
        $buildLaborCost = (float) ($build?->labor_cost ?? 0);
        $buildEquipmentCost = (float) ($build?->equipment_cost ?? 0);
        $buildTrackerSubtotalCosts = $buildMaterialsCost + $buildLaborCost + $buildEquipmentCost;
        $buildVarianceFromTrackerBudget = $constructionContract - $constructionCost;
        $collectionProgressPct = $contractAmount > 0 ? ($totalClientPayment / $contractAmount) * 100 : 0;

        $computed = [
            'contract_amount' => $contractAmount,
            'design_fee' => $designContractAmount,
            'construction_cost' => $constructionCost,
            'total_client_payment' => $totalClientPayment,
            'remaining_balance' => $remainingBalance,
            'last_paid_date' => $lastPaidDate,
            'overall_progress' => $overallProgress,
            'computation_sources' => [
                'design_tracker' => [
                    'design_contract_amount' => $designContractAmount,
                    'downpayment' => $designDownpayment,
                    'total_received' => $designTotalReceived,
                    'office_payroll_deduction' => $designOfficePayrollDeduction,
                    'net_after_office_payroll_deduction' => $designNetAfterOfficeDeduction,
                    'remaining_design_balance' => $designRemaining,
                    'design_progress' => $designProgress,
                    'client_approval_status' => $design?->client_approval_status ?: 'pending',
                    'share_of_total_budget_pct' => $designTrackerSharePct,
                ],
                'build_tracker' => [
                    'construction_contract' => $constructionContract,
                    'recorded_total_client_payment' => $buildTrackerClientPayment,
                    'materials_cost' => $buildMaterialsCost,
                    'labor_cost' => $buildLaborCost,
                    'equipment_cost' => $buildEquipmentCost,
                    'tracker_cost_subtotal' => $buildTrackerSubtotalCosts,
                    'actual_expenses_total' => $constructionCost,
                    'variance_vs_actual_expenses' => $buildVarianceFromTrackerBudget,
                ],
                'finance_actuals' => [
                    'payments_total' => $totalClientPayment,
                    'collection_progress_pct' => $collectionProgressPct,
                    'remaining_balance' => $remainingBalance,
                    'last_paid_date' => $lastPaidDate,
                ],
                'project_financials_snapshot' => [
                    'total_budget_contract_amount' => $contractAmount,
                    'design_fee_manual' => $manualDesignFee,
                    'design_fee_share_of_total_budget_pct' => $manualDesignFeeSharePct,
                    'construction_cost' => $constructionCost,
                    'total_client_payment' => $totalClientPayment,
                    'remaining_balance' => $remainingBalance,
                    'last_paid_date' => $lastPaidDate,
                ],
                'sync_checks' => [
                    'design_fee_manual_minus_design_tracker_contract' => $manualDesignFee - $designContractAmount,
                    'manual_derived_build_budget' => $contractAmount - $manualDesignFee,
                    'tracker_build_budget' => $constructionContract,
                    'tracker_build_budget_minus_manual_derived_build_budget' => $constructionContract - ($contractAmount - $manualDesignFee),
                ],
                'deductions' => [
                    'design_office_payroll_deduction' => $designOfficePayrollDeduction,
                    'includes_design_office_payroll_deduction_in_project_total' => false,
                    'includes_payroll_deductions_in_project_total' => false,
                    'payroll_deductions_note' => 'Payroll deductions are not included in Project Computations because payroll rows are not linked to project_id.',
                ],
            ],
        ];

        // Keep project financial snapshot columns aligned with tracker-derived values,
        // except design_fee which is manually controlled in Project Financials.
        Project::whereKey($project->id)->update([
            'contract_amount' => $computed['contract_amount'],
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
