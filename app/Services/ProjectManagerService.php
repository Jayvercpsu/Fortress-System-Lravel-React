<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Project;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Data service for the Project Manager role.
 *
 * The PM counter-checks the accomplishments/attendance that foremen submit
 * through the JotForm flow, and can also record weekly accomplishments on
 * behalf of the project's foremen — reusing the exact same weekly grid
 * payload/save functions the JotForm uses so both stay in sync.
 */
class ProjectManagerService
{
    public function __construct(
        private readonly PayrollService $payrollService,
        private readonly PublicProgressService $publicProgressService,
        private readonly ProjectService $projectService
    ) {
    }

    public function dashboardPayload(Request $request): array
    {
        $totalProjectsCount = Project::query()->where('phase', 'Construction')->count();

        $projects = Project::query()
            ->where('phase', 'Construction')
            ->orderBy('name')
            ->get(['id', 'name', 'client', 'phase', 'status', 'overall_progress', 'assigned'])
            ->map(fn (Project $project) => $this->projectListItem($project))
            ->values();

        $foremen = User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname']);

        // Recent foreman submissions — the latest accomplishments that need counter-checking.
        $recentSubmissions = WeeklyAccomplishment::query()
            ->where('is_placeholder', false)
            ->with('foreman:id,fullname', 'project:id,name')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(['id', 'foreman_id', 'project_id', 'scope_of_work', 'percent_completed', 'week_start', 'created_at'])
            ->map(fn (WeeklyAccomplishment $row) => [
                'id' => $row->id,
                'foreman_name' => $row->foreman?->fullname,
                'project_name' => $row->project?->name,
                'project_id' => $row->project_id,
                'scope_of_work' => $row->scope_of_work,
                'percent_completed' => (float) $row->percent_completed,
                'week_start' => optional($row->week_start)->toDateString(),
                'submitted_at' => $row->created_at?->toDateTimeString(),
            ])
            ->values();

        // Projects with low reported progress (potential red flags for counter-checking).
        $lowProgressProjects = $projects
            ->filter(fn (array $project) => $project['overall_progress'] >= 0 && $project['overall_progress'] < 30)
            ->values();

        return [
            'projects' => $projects,
            'stats' => [
                'total_projects' => $totalProjectsCount,
                'low_progress_projects' => $lowProgressProjects->count(),
                'total_foremen' => $foremen->count(),
                'pending_accomplishments' => WeeklyAccomplishment::query()
                    ->where('is_placeholder', false)
                    ->count(),
                'total_attendance_records' => Attendance::query()->count(),
                'total_attendance_hours' => round((float) Attendance::query()->sum('hours'), 1),
            ],
            'recentSubmissions' => $recentSubmissions,
            'lowProgressProjects' => $lowProgressProjects,
            'foremen' => $foremen->map(fn (User $user) => ['id' => $user->id, 'fullname' => $user->fullname])->values(),
        ];
    }

    public function projectPayload(Request $request, Project $project): array
    {
        $perPage = 50;

        // Counter-check the foreman's weekly accomplishments submitted via JotForm.
        $accomplishmentsQuery = WeeklyAccomplishment::query()
            ->where('project_id', $project->id)
            ->with('foreman:id,fullname')
            ->orderByDesc('created_at');

        $accomplishmentsPaginator = $accomplishmentsQuery
            ->paginate($perPage, ['*'], 'acc_page', $request->query('acc_page', 1));

        $accomplishments = collect($accomplishmentsPaginator->items())
            ->map(fn (WeeklyAccomplishment $row) => [
                'id' => $row->id,
                'foreman_name' => $row->foreman?->fullname,
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
            ->paginate($perPage, ['*'], 'att_page', $request->query('att_page', 1));

        $attendanceSummary = collect($attendanceSummaryPaginator->items())
            ->map(fn ($row) => [
                'worker_name' => $row->worker_name,
                'worker_role' => $row->worker_role,
                'total_hours' => round((float) $row->total_hours, 1),
                'days_logged' => (int) $row->days_logged,
                'latest_submit' => $row->latest_submit ? Carbon::parse($row->latest_submit)->toDateTimeString() : null,
            ])
            ->values();

        // Summary stats for counter-checking (totals across all pages).
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
                'overall_progress' => (int) ($project->overall_progress ?? 0),
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
                'per_page' => $perPage,
                'current_page' => $accomplishmentsPaginator->currentPage(),
                'last_page' => max(1, $accomplishmentsPaginator->lastPage()),
                'total' => $accomplishmentsPaginator->total(),
                'from' => $accomplishmentsPaginator->firstItem(),
                'to' => $accomplishmentsPaginator->lastItem(),
            ],
            'attendanceSummaryTable' => [
                'per_page' => $perPage,
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
        $search = trim((string) $request->query('search', ''));
        $projectId = trim((string) $request->query('project_id', ''));
        $foremanId = trim((string) $request->query('foreman_id', ''));
        $date = trim((string) $request->query('date', ''));

        $allowedPerPage = [5, 10, 25, 50, 100];
        $perPage = (int) $request->query('per_page', 50);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 50;
        }

        $query = Attendance::query()
            ->whereNotNull('date')
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

        $projects = Project::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Project $p) => ['id' => $p->id, 'name' => $p->name])
            ->values();

        $foremen = User::query()
            ->where('role', User::ROLE_FOREMAN)
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
        // Reuse the existing read-only payroll index payload (no mutating actions).
        return $this->payrollService->indexPayload($request);
    }

    public function accomplishmentPayload(Request $request): array
    {
        $projects = Project::query()
            ->where('phase', Project::PHASE_CONSTRUCTION)
            ->orderBy('name')
            ->get(['id', 'name', 'phase'])
            ->map(fn (Project $p) => [
                'id' => (int) $p->id,
                'name' => (string) $p->name,
                'phase' => (string) $p->phase,
            ])
            ->values();

        $projectId = (int) $request->query('project_id', $projects->first()['id'] ?? 0);
        $project = Project::query()->find($projectId);

        if (!$project || $project->phase !== Project::PHASE_CONSTRUCTION) {
            return [
                'projects' => $projects->all(),
                'foremen' => [],
                'selectedProjectId' => 0,
                'selectedForemanId' => 0,
                'selectedForemanName' => '',
                'selectedProjectName' => '',
                'jotformLink' => '',
                'weekly' => $this->emptyWeeklyGrid(),
            ];
        }

        $projectId = (int) $project->id;
        $assignedForemanIds = $this->projectService->assignedForemanIds($project);

        $foremen = User::query()
            ->whereIn('id', $assignedForemanIds)
            ->where('role', User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $user) => ['id' => (int) $user->id, 'fullname' => (string) $user->fullname])
            ->values();

        $foremanId = (int) $request->query('foreman_id', 0);
        if ($foremanId <= 0 || $foremen->doesntContain(fn (array $foreman) => (int) $foreman['id'] === $foremanId)) {
            $foremanId = (int) ($foremen->first()['id'] ?? 0);
        }

        $foreman = $foremanId > 0 ? User::query()->find($foremanId) : null;

        $weeklyGrid = $this->emptyWeeklyGrid();
        $jotformLink = '';

        if ($foreman && $foreman->role === User::ROLE_FOREMAN) {
            $weeklyGrid = $this->publicProgressService->weeklyGridPayload(
                $projectId,
                $foremanId,
                trim((string) ($foreman->fullname ?? ''))
            );
            $jotformLink = $this->projectService->resolveJotformLink($project, $foremanId);
        }

        return [
            'projects' => $projects->all(),
            'foremen' => $foremen->values()->all(),
            'selectedProjectId' => $projectId,
            'selectedForemanId' => $foremanId,
            'selectedForemanName' => trim((string) ($foreman->fullname ?? '')),
            'selectedProjectName' => (string) $project->name,
            'jotformLink' => $jotformLink,
            'weekly' => $weeklyGrid,
        ];
    }

    public function storeAccomplishments(Request $request): void
    {
        $validated = $request->validate([
            'project_id' => ['required', 'integer'],
            'foreman_id' => ['required', 'integer'],
            'week_start' => ['required', 'date'],
            'scopes' => ['nullable', 'array'],
            'scopes.*.scope_of_work' => ['required_with:scopes', 'string', 'max:255'],
            'scopes.*.percent_completed' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'removed_scopes' => ['nullable', 'array'],
            'removed_scopes.*' => ['nullable', 'string', 'max:255'],
        ]);

        $project = Project::query()->findOrFail((int) $validated['project_id']);

        abort_if($project->phase !== Project::PHASE_CONSTRUCTION, 422, 'Only construction-phase projects accept accomplishment updates.');

        $assignedForemanIds = $this->projectService->assignedForemanIds($project);
        abort_unless(in_array((int) $validated['foreman_id'], $assignedForemanIds, true), 422, 'Selected foreman is not assigned to this project.');

        $foreman = User::query()->findOrFail((int) $validated['foreman_id']);

        $weekStart = Carbon::parse($validated['week_start'])->startOfWeek(Carbon::MONDAY)->toDateString();

        $this->publicProgressService->saveWeeklyProgress(
            (int) $project->id,
            (int) $foreman->id,
            trim((string) ($foreman->fullname ?? '')),
            $weekStart,
            $validated['scopes'] ?? [],
            $validated['removed_scopes'] ?? [],
            true
        );
    }

    private function emptyWeeklyGrid(): array
    {
        return [
            'current_week_start' => Carbon::now('Asia/Manila')
                ->startOfWeek(Carbon::MONDAY)
                ->toDateString(),
            'weekly_scope_of_works' => [],
            'weekly_scope_of_works_by_week' => [],
            'weekly_scope_defaults_enabled' => false,
            'weekly_scope_photo_map' => [],
            'weekly_saved_by_week' => [],
        ];
    }

    private function projectListItem(Project $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'client' => $project->client,
            'phase' => $project->phase,
            'status' => $project->status,
            'overall_progress' => (int) ($project->overall_progress ?? 0),
            'assigned' => $project->assigned,
        ];
    }
}
