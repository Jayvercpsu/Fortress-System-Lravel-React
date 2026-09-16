<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Support\Uploads\UploadManager;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\UploadedFile;

/**
 * Data service for the Project Manager role.
 *
 * Data model:
 * - A project has at most one assigned PM (project_assignments,
 *   role_in_project = project_manager). Every endpoint below only ever
 *   serves projects assigned to the logged-in PM (403 otherwise).
 * - PM accomplishments are independent rows in weekly_accomplishments
 *   with foreman_id NULL, submitted by the PM. They never reuse Foreman
 *   JotForm records, and historical PM rows stored under a foreman_id
 *   are frozen (ignored by both sides).
 * - PM progress comes from PmProgressService (weighted from PM rows
 *   only). Foreman data on assigned projects stays visible for
 *   counter-checking, but never feeds PM numbers.
 */
class ProjectManagerService
{
    public function __construct(
        private readonly PayrollService $payrollService,
        private readonly ProjectService $projectService,
        private readonly PmProgressService $pmProgressService
    ) {
    }

    /**
     * Project ids assigned to the logged-in PM.
     *
     * @return int[]
     */
    private function assignedProjectIds(Request $request): array
    {
        return $this->projectService->assignedProjectIdsForPm((int) $request->user()->id);
    }

    private function ensureProjectAssigned(Project $project, int $pmUserId): void
    {
        abort_unless(
            $this->projectService->assignedPmId($project) === $pmUserId,
            403,
            'This project is not assigned to your account.'
        );
    }

    /**
     * Exclude frozen historical PM rows (PM-submitted, foreman_id set)
     * from foreman-side queries. PM-side queries select foreman_id NULL
     * directly and never match frozen rows.
     */
    private function excludeFrozenPmRows($query): void
    {
        $pmUserIds = User::query()
            ->where('role', User::ROLE_PROJECT_MANAGER)
            ->pluck('id')
            ->all();

        $query->where(fn ($q) => $q
            ->whereNull('weekly_accomplishments.foreman_id')
            ->orWhere(fn ($q2) => $q2
                ->whereNotNull('weekly_accomplishments.foreman_id')
                ->where(fn ($q3) => $q3
                    ->whereNull('weekly_accomplishments.submitted_by')
                    ->orWhereNotIn('weekly_accomplishments.submitted_by', $pmUserIds))));
    }

    public function dashboardPayload(Request $request): array
    {
        $pmUserId = (int) $request->user()->id;
        $assignedIds = $this->assignedProjectIds($request);

        $projectsQuery = Project::query()
            ->where('phase', Project::PHASE_CONSTRUCTION)
            ->whereIn('id', $assignedIds)
            ->orderBy('name');

        $totalProjectsCount = (clone $projectsQuery)->count();

        $projects = $projectsQuery
            ->get(['id', 'name', 'client', 'phase', 'status', 'assigned']);

        $pmProgressByProject = $this->pmProgressService->progressByProjectIds(
            $projects->pluck('id')->all()
        );

        $projects = $projects
            ->map(fn (Project $project) => $this->projectListItem($project, $pmProgressByProject))
            ->values();

        $foremen = collect();
        if ($assignedIds !== []) {
            $foremen = User::query()
                ->where('role', User::ROLE_FOREMAN)
                ->where(function ($query) use ($assignedIds): void {
                    foreach ($assignedIds as $projectId) {
                        $query->orWhereIn('id', function ($sub) use ($projectId): void {
                            $sub->select('user_id')
                                ->from('project_assignments')
                                ->where('project_id', $projectId)
                                ->where('role_in_project', 'foreman');
                        });
                    }
                })
                ->orderBy('fullname')
                ->get(['id', 'fullname']);
        }

        // The PM's own recent accomplishment rows.
        $recentSubmissions = WeeklyAccomplishment::query()
            ->whereNull('foreman_id')
            ->where('submitted_by', $pmUserId)
            ->where('is_placeholder', false)
            ->whereIn('project_id', $assignedIds)
            ->with('project:id,name')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(['id', 'project_id', 'scope_of_work', 'percent_completed', 'week_start', 'created_at'])
            ->map(fn (WeeklyAccomplishment $row) => [
                'id' => $row->id,
                'project_name' => $row->project?->name,
                'project_id' => $row->project_id,
                'scope_of_work' => $row->scope_of_work,
                'percent_completed' => (float) $row->percent_completed,
                'week_start' => optional($row->week_start)->toDateString(),
                'submitted_at' => $row->created_at?->toDateTimeString(),
            ])
            ->values();

        $lowProgressProjects = $projects
            ->filter(fn (array $project) => $project['overall_progress'] >= 0 && $project['overall_progress'] < 30)
            ->values();

        $pendingAccomplishments = $assignedIds === [] ? 0 : (int) DB::query()
            ->fromSub(
                WeeklyAccomplishment::query()
                    ->whereNull('foreman_id')
                    ->where('is_placeholder', false)
                    ->whereIn('project_id', $assignedIds)
                    ->select('project_id', 'scope_of_work')
                    ->distinct(),
                'distinct_scopes'
            )
            ->count();

        $attendanceQuery = Attendance::query()->whereIn('project_id', $assignedIds);

        return [
            'projects' => $projects,
            'stats' => [
                'total_projects' => $totalProjectsCount,
                'low_progress_projects' => $lowProgressProjects->count(),
                'total_foremen' => $foremen->count(),
                'pending_accomplishments' => $pendingAccomplishments,
                'total_attendance_records' => (clone $attendanceQuery)->count(),
                'total_attendance_hours' => round((float) (clone $attendanceQuery)->sum('hours'), 1),
            ],
            'recentSubmissions' => $recentSubmissions,
            'lowProgressProjects' => $lowProgressProjects,
            'foremen' => $foremen->map(fn (User $user) => ['id' => $user->id, 'fullname' => $user->fullname])->values(),
        ];
    }

    public function projectPayload(Request $request, Project $project): array
    {
        $this->ensureProjectAssigned($project, (int) $request->user()->id);

        $allowedPerPage = [10, 20, 25, 50, 100];
        $accPerPage = (int) $request->query('acc_per_page', 50);
        if (!in_array($accPerPage, $allowedPerPage, true)) {
            $accPerPage = 50;
        }
        $attPerPage = (int) $request->query('att_per_page', 50);
        if (!in_array($attPerPage, $allowedPerPage, true)) {
            $attPerPage = 50;
        }

        // Counter-check rows: foreman JotForm submissions only (PM-side
        // rows never appear here), excluding frozen historical rows.
        $accomplishmentsQuery = WeeklyAccomplishment::query()
            ->where('project_id', $project->id)
            ->whereNotNull('weekly_accomplishments.foreman_id')
            ->with('foreman:id,fullname', 'submitter:id,fullname,role')
            ->orderByDesc('created_at');
        $this->excludeFrozenPmRows($accomplishmentsQuery);

        $accomplishmentsPaginator = $accomplishmentsQuery
            ->paginate($accPerPage, ['*'], 'acc_page', $request->query('acc_page', 1));

        $accomplishments = collect($accomplishmentsPaginator->items())
            ->map(fn (WeeklyAccomplishment $row) => [
                'id' => $row->id,
                'foreman_name' => $row->foreman?->fullname,
                'submitted_by_name' => $row->submitter?->fullname ?? $row->foreman?->fullname,
                'scope_of_work' => $row->scope_of_work,
                'percent_completed' => (float) $row->percent_completed,
                'week_start' => optional($row->week_start)->toDateString(),
                'is_placeholder' => (bool) $row->is_placeholder,
                'submitted_at' => $row->created_at?->toDateTimeString(),
            ])
            ->values();

        // Attendance summary for this project (read-only).
        $attendanceSummaryQuery = Attendance::query()
            ->where('project_id', $project->id)
            ->selectRaw('worker_name, worker_role, COALESCE(SUM(hours), 0) as total_hours, COUNT(*) as days_logged, MAX(created_at) as latest_submit')
            ->groupBy('worker_name', 'worker_role')
            ->orderByDesc('latest_submit');

        $attendanceSummaryPaginator = $attendanceSummaryQuery
            ->paginate($attPerPage, ['*'], 'att_page', $request->query('att_page', 1));

        $attendanceSummary = collect($attendanceSummaryPaginator->items())
            ->map(fn ($row) => [
                'worker_name' => $row->worker_name,
                'worker_role' => $row->worker_role,
                'total_hours' => round((float) $row->total_hours, 1),
                'days_logged' => (int) $row->days_logged,
                'latest_submit' => $row->latest_submit ? Carbon::parse($row->latest_submit)->toDateTimeString() : null,
            ])
            ->values();

        $totalAccomplishments = (int) $accomplishmentsPaginator->total();
        $totalAttendanceHours = round((float) Attendance::query()
            ->where('project_id', $project->id)
            ->sum('hours'), 1);
        $totalAttendanceDays = (int) Attendance::query()
            ->where('project_id', $project->id)
            ->count();
        $uniqueForemen = (int) WeeklyAccomplishment::query()
            ->where('project_id', $project->id)
            ->whereNotNull('foreman_id')
            ->distinct('foreman_id')
            ->count('foreman_id');

        return [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'client' => $project->client,
                'type' => $project->type,
                'location' => $project->location,
                'phase' => $project->phase,
                'status' => $project->status,
                'overall_progress' => $this->pmProgressService->progressForProject((int) $project->id) ?? 0.0,
                'target' => optional($project->target)->toDateString(),
                'assigned' => $project->assigned,
            ],
            'accomplishments' => $accomplishments,
            'attendanceSummary' => $attendanceSummary,
            'projectStats' => [
                'total_accomplishments' => $totalAccomplishments,
                'total_attendance_hours' => $totalAttendanceHours,
                'total_attendance_days' => $totalAttendanceDays,
                'unique_foremen' => $uniqueForemen,
            ],
            'accomplishmentsTable' => [
                'per_page' => $accPerPage,
                'current_page' => $accomplishmentsPaginator->currentPage(),
                'last_page' => max(1, $accomplishmentsPaginator->lastPage()),
                'total' => $accomplishmentsPaginator->total(),
                'from' => $accomplishmentsPaginator->firstItem(),
                'to' => $accomplishmentsPaginator->lastItem(),
            ],
            'attendanceSummaryTable' => [
                'per_page' => $attPerPage,
                'current_page' => $attendanceSummaryPaginator->currentPage(),
                'last_page' => max(1, $attendanceSummaryPaginator->lastPage()),
                'total' => $attendanceSummaryPaginator->total(),
                'from' => $attendanceSummaryPaginator->firstItem(),
                'to' => $attendanceSummaryPaginator->lastItem(),
            ],
        ];
    }

    public function attendancePayload(Request $request): array
    {
        $assignedIds = $this->assignedProjectIds($request);

        $search = trim((string) $request->query('search', ''));
        $projectId = trim((string) $request->query('project_id', ''));
        $foremanId = trim((string) $request->query('foreman_id', ''));
        $date = trim((string) $request->query('date', ''));

        if ($projectId !== '') {
            abort_unless(in_array((int) $projectId, $assignedIds, true), 403, 'This project is not assigned to your account.');
        }

        $allowedPerPage = [5, 10, 20, 25, 50, 100];
        $perPage = (int) $request->query('per_page', 50);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 50;
        }

        $query = Attendance::query()
            ->whereNotNull('date')
            ->whereIn('project_id', $assignedIds)
            ->with(['project:id,name', 'foreman:id,fullname']);

        if ($projectId !== '') {
            $query->where('project_id', (int) $projectId);
        }
        if ($foremanId !== '') {
            $query->where('foreman_id', (int) $foremanId);
        }
        if ($date !== '' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $query->whereDate('date', $date);
        }
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('worker_name', 'like', "%{$search}%")
                    ->orWhere('worker_role', 'like', "%{$search}%")
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        $paginator = $query
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        $attendances = collect($paginator->items())
            ->map(fn (Attendance $attendance) => [
                'id' => $attendance->id,
                'date' => optional($attendance->date)?->toDateString(),
                'worker_name' => $attendance->worker_name,
                'worker_role' => $attendance->worker_role,
                'project_id' => $attendance->project_id,
                'project_name' => $attendance->project?->name,
                'foreman_name' => $attendance->foreman?->fullname,
                'time_in' => $attendance->time_in,
                'time_out' => $attendance->time_out,
                'hours' => (float) ($attendance->hours ?? 0),
                'attendance_code' => $attendance->attendance_code,
            ])
            ->values();

        // Project dropdown: assigned projects only.
        $projects = Project::query()
            ->whereIn('id', $assignedIds)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Project $p) => ['id' => $p->id, 'name' => $p->name])
            ->values();

        // The foreman filter only offers foremen of the PM's assigned
        // projects (or of the selected assigned project).
        $foremanProjectIds = $projectId !== '' ? [(int) $projectId] : $assignedIds;
        $foremanIds = [];
        foreach ($foremanProjectIds as $id) {
            $assignedProject = Project::query()->find($id);
            if ($assignedProject) {
                $foremanIds = array_merge($foremanIds, $this->projectService->assignedForemanIds($assignedProject));
            }
        }
        $foremanIds = array_values(array_unique(array_map('intval', $foremanIds)));

        $foremen = User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->whereIn('id', $foremanIds)
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $u) => ['id' => $u->id, 'fullname' => $u->fullname])
            ->values();

        return [
            'attendances' => $attendances,
            'projects' => $projects,
            'foremen' => $foremen,
            'attendanceTable' => [
                'search' => $search,
                'date' => $date,
                'project_id' => $projectId,
                'foreman_id' => $foremanId,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }

    public function payrollPayload(Request $request): array
    {
        $assignedIds = $this->assignedProjectIds($request);

        // PM payroll is worker payroll scoped to assigned projects. The
        // global staff group is never served here.
        $request->query->set('group', 'workers');

        $requestedId = (int) $request->query('project_id', 0);
        if ($requestedId > 0) {
            abort_unless(in_array($requestedId, $assignedIds, true), 403, 'This project is not assigned to your account.');
        } elseif (!empty($assignedIds)) {
            $request->query->set('project_id', $assignedIds[0]);
        } else {
            return $this->emptyPayrollPayload($request);
        }

        // Reuse the existing read-only payroll index payload (no mutating actions).
        return $this->payrollService->indexPayload($request);
    }

    private function emptyPayrollPayload(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 50);

        return [
            'payrolls' => [],
            'totalPayable' => 0.0,
            'workerOptions' => [],
            'payrollGroup' => 'workers',
            'projectOptions' => [],
            'selectedProject' => null,
            'payrollTable' => [
                'search' => $search,
                'cutoff_start' => trim((string) $request->query('cutoff_start', '')),
                'cutoff_end' => trim((string) $request->query('cutoff_end', '')),
                'per_page' => $perPage,
                'current_page' => 1,
                'last_page' => 1,
                'total' => 0,
                'from' => null,
                'to' => null,
            ],
        ];
    }

    /**
     * Independent PM accomplishments grid: the PM's own rows for one of
     * their assigned projects and one week. Foreman JotForm rows never
     * feed the editable grid — they are served separately as read-only
     * `foremanScopes` counter-check data for the Compare view.
     */
    public function accomplishmentPayload(Request $request): array
    {
        $pmUserId = (int) $request->user()->id;
        $assignedIds = $this->assignedProjectIds($request);

        $projects = Project::query()
            ->where('phase', Project::PHASE_CONSTRUCTION)
            ->whereIn('id', $assignedIds)
            ->orderBy('name')
            ->get(['id', 'name', 'phase'])
            ->map(fn (Project $p) => [
                'id' => (int) $p->id,
                'name' => (string) $p->name,
                'phase' => (string) $p->phase,
            ])
            ->values();

        $projectId = (int) $request->query('project_id', $projects->first()['id'] ?? 0);
        $project = $projectId > 0 ? Project::query()->find($projectId) : null;

        if (!$project || $project->phase !== Project::PHASE_CONSTRUCTION || !in_array((int) $project->id, $assignedIds, true)) {
            return [
                'projects' => $projects->all(),
                'selectedProjectId' => 0,
                'selectedProjectName' => '',
                'selectedWeek' => $this->currentWeekStart(),
                'currentWeekStart' => $this->currentWeekStart(),
                'planScopes' => [],
                'savedScopes' => [],
                'scopePhotoMap' => [],
                'pmProgress' => null,
                'foremanScopes' => [],
                'assignedForemen' => [],
            ];
        }

        $projectId = (int) $project->id;
        $weekStart = trim((string) $request->query('week_start', ''));
        if ($weekStart === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $weekStart)) {
            $weekStart = $this->currentWeekStart();
        }

        $planScopes = ProjectScope::query()
            ->where('project_id', $projectId)
            ->whereRaw("TRIM(COALESCE(scope_name, '')) != ?", [''])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['scope_name', 'weight_percent'])
            ->map(fn (ProjectScope $scope) => [
                'scope_of_work' => (string) $scope->scope_name,
                'weight_percent' => (float) ($scope->weight_percent ?? 0),
            ])
            ->values()
            ->all();

        $savedScopes = WeeklyAccomplishment::query()
            ->where('project_id', $projectId)
            ->whereNull('foreman_id')
            ->where('submitted_by', $pmUserId)
            ->where('is_placeholder', false)
            ->whereDate('week_start', $weekStart)
            ->orderBy('id')
            ->get(['id', 'scope_of_work', 'percent_completed'])
            ->groupBy(fn (WeeklyAccomplishment $row) => strtolower(trim((string) $row->scope_of_work)))
            ->map(fn ($group) => $group->sortByDesc('id')->first())
            ->values()
            ->map(fn (WeeklyAccomplishment $row) => [
                'scope_of_work' => (string) $row->scope_of_work,
                'percent_completed' => (float) $row->percent_completed,
            ])
            ->values()
            ->all();

        return [
            'projects' => $projects->all(),
            'selectedProjectId' => $projectId,
            'selectedProjectName' => (string) $project->name,
            'selectedWeek' => $weekStart,
            'currentWeekStart' => $this->currentWeekStart(),
            'planScopes' => $planScopes,
            'savedScopes' => $savedScopes,
            'scopePhotoMap' => $this->pmScopePhotoMap($projectId),
            'pmProgress' => $this->pmProgressService->progressForProject($projectId),
            'foremanScopes' => $this->foremanCompareScopes($projectId, $weekStart),
            'assignedForemen' => $this->assignedForemenForCompare($project),
        ];
    }

    /**
     * Read-only foreman counter-check rows for the Compare view: the
     * latest foreman submission per scope for one project + week.
     * Frozen historical PM rows are excluded, same as the project
     * counter-check payload. Never feeds PM numbers.
     */
    private function foremanCompareScopes(int $projectId, string $weekStart): array
    {
        $query = WeeklyAccomplishment::query()
            ->where('project_id', $projectId)
            ->whereNotNull('foreman_id')
            ->whereDate('week_start', $weekStart)
            ->with('foreman:id,fullname', 'submitter:id,fullname,role')
            ->orderBy('scope_of_work')
            ->orderByDesc('id');
        $this->excludeFrozenPmRows($query);

        return $query
            ->get(['id', 'foreman_id', 'submitted_by', 'scope_of_work', 'percent_completed', 'week_start', 'is_placeholder', 'created_at'])
            ->groupBy(fn (WeeklyAccomplishment $row) => strtolower(trim((string) $row->scope_of_work)))
            ->map(fn ($group) => $group->sortByDesc('id')->first())
            ->values()
            ->map(fn (WeeklyAccomplishment $row) => [
                'scope_of_work' => (string) $row->scope_of_work,
                'percent_completed' => (float) $row->percent_completed,
                'foreman_name' => $row->foreman?->fullname,
                'submitted_by_name' => $row->submitter?->fullname ?? $row->foreman?->fullname,
                'week_start' => optional($row->week_start)->toDateString(),
                'submitted_at' => $row->created_at?->toDateTimeString(),
                'is_placeholder' => (bool) $row->is_placeholder,
            ])
            ->values()
            ->all();
    }

    /**
     * Foremen assigned to the project, shown in the Compare view even
     * when nobody submitted for the selected week.
     */
    private function assignedForemenForCompare(Project $project): array
    {
        $ids = array_values(array_unique(array_map(
            'intval',
            $this->projectService->assignedForemanIds($project)
        )));

        if ($ids === []) {
            return [];
        }

        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->whereIn('id', $ids)
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $user) => ['id' => $user->id, 'fullname' => $user->fullname])
            ->values()
            ->all();
    }

    /**
     * The PM's own scope photos for a project, keyed by lower-cased scope
     * name. Only rows uploaded through the PM grid ('[PM Weekly]' caption)
     * are included — Foreman uploads never appear here.
     */
    private function pmScopePhotoMap(int $projectId): array
    {
        $photos = ScopePhoto::query()
            ->select([
                'scope_photos.id',
                'scope_photos.photo_path',
                'scope_photos.caption',
                'scope_photos.created_at',
                'project_scopes.scope_name',
            ])
            ->join('project_scopes', 'project_scopes.id', '=', 'scope_photos.project_scope_id')
            ->where('project_scopes.project_id', $projectId)
            ->where('scope_photos.caption', 'like', '[PM Weekly]%')
            ->orderByDesc('scope_photos.id')
            ->get();

        $map = [];
        foreach ($photos as $photo) {
            $scopeName = trim((string) ($photo->scope_name ?? ''));
            if ($scopeName === '') {
                continue;
            }

            $scopeKey = strtolower($scopeName);
            if (!isset($map[$scopeKey])) {
                $map[$scopeKey] = [];
            }

            if (count($map[$scopeKey]) >= 40) {
                continue;
            }

            $map[$scopeKey][] = [
                'id' => (int) $photo->id,
                'photo_path' => $photo->photo_path,
                'caption' => $photo->caption,
                'created_at' => optional($photo->created_at)?->toDateTimeString(),
                'week_start' => $this->extractWeekStartFromCaption($photo->caption),
            ];
        }

        return $map;
    }

    private function extractWeekStartFromCaption(?string $caption): ?string
    {
        $text = trim((string) ($caption ?? ''));
        if ($text === '') {
            return null;
        }

        if (preg_match('/Week:\s*(\d{4}-\d{2}-\d{2})/i', $text, $matches) === 1) {
            return $matches[1];
        }

        return null;
    }

    /**
     * Delete one of the PM's own scope photos (same as the foreman JotForm
     * delete). Only '[PM Weekly]' photos on projects assigned to the
     * logged-in PM can be removed — anything else is a 404.
     */
    public function deleteScopePhoto(Request $request, ScopePhoto $scopePhoto): void
    {
        $pmUserId = (int) $request->user()->id;
        $scopePhoto->loadMissing('scope');

        $projectId = (int) ($scopePhoto->scope?->project_id ?? 0);

        abort_unless(
            $projectId > 0
                && in_array($projectId, $this->assignedProjectIds($request), true)
                && str_starts_with(trim((string) ($scopePhoto->caption ?? '')), '[PM Weekly]'),
            404
        );

        $path = $scopePhoto->photo_path;
        $scopePhoto->delete();
        UploadManager::delete($path);
    }

    /**
     * Store the PM's own weekly accomplishments. No foreman is involved:
     * rows are created with foreman_id NULL so they stay fully separate
     * from Foreman JotForm submissions. Scope-plan progress is never
     * touched here (that column stays foreman-driven).
     */
    public function storeAccomplishments(Request $request): void
    {
        $validated = $request->validate([
            'project_id' => ['required', 'integer'],
            'week_start' => ['required', 'date'],
            'scopes' => ['nullable', 'array'],
            'scopes.*.scope_of_work' => ['required_with:scopes', 'string', 'max:255'],
            'scopes.*.percent_completed' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'scopes.*.photo_caption' => ['nullable', 'string', 'max:255'],
            'scopes.*.photos' => ['nullable', 'array'],
            'scopes.*.photos.*' => UploadManager::imageRules(),
            'removed_scopes' => ['nullable', 'array'],
            'removed_scopes.*' => ['nullable', 'string', 'max:255'],
        ]);

        $pmUserId = (int) $request->user()->id;
        $project = Project::query()->findOrFail((int) $validated['project_id']);

        abort_if($project->phase !== Project::PHASE_CONSTRUCTION, 422, 'Only construction-phase projects accept accomplishment updates.');
        $this->ensureProjectAssigned($project, $pmUserId);

        $weekStart = Carbon::parse($validated['week_start'])->startOfWeek(Carbon::MONDAY)->toDateString();

        $resubmittedKeys = [];
        foreach ($validated['scopes'] ?? [] as $scope) {
            $scopeName = trim((string) ($scope['scope_of_work'] ?? ''));
            if ($scopeName === '') {
                continue;
            }
            $resubmittedKeys[] = strtolower($scopeName);
            $percent = round((float) ($scope['percent_completed'] ?? 0), 2);

            // Photos always persist, even when the percent is unchanged —
            // otherwise re-submitting the same percent with new photos
            // would silently drop the upload.
            $this->storePmScopePhotos((int) $project->id, $scopeName, trim((string) ($scope['photo_caption'] ?? '')), $scope['photos'] ?? [], $weekStart, $pmUserId, (string) $request->user()->role);

            // Append-only dedup: skip the history row when the PM's latest
            // row for this scope already carries the same rounded percent.
            $latest = WeeklyAccomplishment::query()
                ->where('project_id', (int) $project->id)
                ->whereNull('foreman_id')
                ->where('submitted_by', $pmUserId)
                ->where('is_placeholder', false)
                ->whereRaw('LOWER(TRIM(scope_of_work)) = ?', [strtolower($scopeName)])
                ->orderByDesc('id')
                ->first(['percent_completed']);

            if ($latest && round((float) $latest->percent_completed, 2) === $percent) {
                continue;
            }

            WeeklyAccomplishment::create([
                'foreman_id' => null,
                'submitted_by' => $pmUserId,
                'project_id' => (int) $project->id,
                'scope_of_work' => $scopeName,
                'percent_completed' => $percent,
                'week_start' => $weekStart,
                'is_placeholder' => false,
            ]);
        }

        $removedKeys = collect($validated['removed_scopes'] ?? [])
            ->map(fn ($name) => strtolower(trim((string) $name)))
            ->filter()
            ->reject(fn (string $key) => in_array($key, $resubmittedKeys, true))
            ->values()
            ->all();

        if ($removedKeys !== []) {
            WeeklyAccomplishment::query()
                ->where('project_id', (int) $project->id)
                ->whereNull('foreman_id')
                ->where('submitted_by', $pmUserId)
                ->whereDate('week_start', $weekStart)
                ->where(function ($query) use ($removedKeys): void {
                    foreach ($removedKeys as $key) {
                        $query->orWhereRaw('LOWER(TRIM(scope_of_work)) = ?', [$key]);
                    }
                })
                ->delete();
        }
    }

    /**
     * PM proof photos attach to the plan scope (shared evidence pool,
     * tagged "[PM Weekly]" in the caption) without touching the scope's
     * progress numbers.
     */
    private function storePmScopePhotos(int $projectId, string $scopeName, string $caption, mixed $photos, string $weekStart, ?int $submittedBy = null, ?string $submittedByRole = null): void
    {
        $uploaded = collect(is_array($photos) ? $photos : [])
            ->filter(fn ($photo) => $photo instanceof UploadedFile)
            ->values();

        if ($uploaded->isEmpty()) {
            return;
        }

        $scopeKey = strtolower($scopeName);
        $planScope = ProjectScope::query()
            ->where('project_id', $projectId)
            ->whereRaw('LOWER(TRIM(scope_name)) = ?', [$scopeKey])
            ->first(['id']);

        if (!$planScope) {
            $planScope = ProjectScope::create([
                'project_id' => $projectId,
                'scope_name' => $scopeName,
                'progress_percent' => 0,
                'status' => ProjectScope::STATUS_NOT_STARTED,
            ]);
        }

        foreach ($uploaded as $photo) {
            $path = UploadManager::store($photo, 'scope-photos/' . $planScope->id);

            ScopePhoto::create(array_filter([
                'project_scope_id' => $planScope->id,
                'photo_path' => $path,
                'caption' => '[PM Weekly] | Week: ' . $weekStart . ' | Scope: ' . $scopeName . ($caption !== '' ? ' | ' . $caption : ''),
                'submitted_by' => $submittedBy,
                'submitted_by_role' => $submittedByRole,
            ], fn ($value) => $value !== null));
        }
    }

    private function currentWeekStart(): string
    {
        return Carbon::now('Asia/Manila')
            ->startOfWeek(Carbon::MONDAY)
            ->toDateString();
    }

    private function projectListItem(Project $project, array $pmProgressByProject = []): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'client' => $project->client,
            'phase' => $project->phase,
            'status' => $project->status,
            // Strictly PM-based (0 when the PM side has no data yet).
            'overall_progress' => $pmProgressByProject[(int) $project->id] ?? 0.0,
            'assigned' => $project->assigned,
        ];
    }
}
