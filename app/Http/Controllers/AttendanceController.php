<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AttendanceController extends Controller
{
    private const PH_TIMEZONE = 'Asia/Manila';
    private const ENTRY_MODE_TIME_LOG = 'time_log';
    private const ENTRY_MODE_STATUS_BASED = 'status_based';
    private const ATTENDANCE_CODES = ['P', 'A', 'H', 'R', 'F'];

    public function index(Request $request)
    {
        $this->authorizeRole($request);

        $allowedPerPage = [5, 10, 25, 50];
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $filters = $this->filtersFromRequest($request);

        $query = Attendance::query()
            ->with(['foreman:id,fullname', 'project:id,name']);

        $this->applyAttendanceFilters($query, $filters, $search);

        $paginator = $query
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        $attendances = collect($paginator->items())
            ->map(function (Attendance $attendance) {
                $entryMode = $this->resolveEntryMode($attendance);
                $attendanceCode = $this->resolveAttendanceCode($attendance, $entryMode);

                return [
                    'id' => $attendance->id,
                    'date' => optional($attendance->date)?->toDateString(),
                    'worker_name' => $attendance->worker_name,
                    'worker_role' => $attendance->worker_role,
                    'foreman_name' => $attendance->foreman?->fullname,
                    'project_id' => $attendance->project_id,
                    'project_name' => $attendance->project?->name,
                    'time_in' => $attendance->time_in,
                    'time_out' => $attendance->time_out,
                    'entry_mode' => $entryMode,
                    'attendance_code' => $attendanceCode['value'],
                    'attendance_code_is_derived' => $attendanceCode['is_derived'],
                    'hours' => (float) ($attendance->hours ?? 0),
                    'selfie_path' => $attendance->selfie_path,
                    'created_at' => $attendance->created_at
                        ? $attendance->created_at->copy()->timezone(self::PH_TIMEZONE)->format('Y-m-d h:i:s A')
                        : null,
                ];
            })
            ->values();

        return Inertia::render($this->rolePage($request, 'Index'), [
            'attendances' => $attendances,
            'attendanceTable' => $this->tableMeta($paginator, $search),
            'filters' => $filters,
            'foremen' => $this->foremanOptions(),
            'projects' => $this->projectOptions(),
            'workerRoles' => $this->workerRoleOptions(),
            'attendanceCodes' => $this->attendanceCodeOptions(),
        ]);
    }

    public function summary(Request $request)
    {
        $this->authorizeRole($request);

        $allowedPerPage = [5, 10, 25, 50];
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $filters = $this->filtersFromRequest($request);

        $base = Attendance::query()
            ->leftJoin('users as foremen', 'foremen.id', '=', 'attendances.foreman_id')
            ->leftJoin('projects', 'projects.id', '=', 'attendances.project_id');

        $this->applyAttendanceFilterJoins($base, $filters, $search);

        $totalsBase = clone $base;
        $summaryTotals = [
            'total_logs' => (int) (clone $totalsBase)->count('attendances.id'),
            'total_hours' => round((float) ((clone $totalsBase)->sum('attendances.hours') ?? 0), 1),
            'unique_workers' => (int) (clone $totalsBase)->distinct('attendances.worker_name')->count('attendances.worker_name'),
            'unique_foremen' => (int) (clone $totalsBase)->distinct('attendances.foreman_id')->count('attendances.foreman_id'),
        ];

        $summaryQuery = $base
            ->selectRaw('
                attendances.worker_name,
                attendances.worker_role,
                attendances.foreman_id,
                foremen.fullname as foreman_name,
                attendances.project_id,
                projects.name as project_name,
                COUNT(attendances.id) as logs_count,
                COUNT(DISTINCT attendances.date) as days_count,
                COALESCE(SUM(attendances.hours), 0) as total_hours,
                MIN(attendances.date) as first_date,
                MAX(attendances.date) as last_date
            ')
            ->groupBy(
                'attendances.worker_name',
                'attendances.worker_role',
                'attendances.foreman_id',
                'foremen.fullname',
                'attendances.project_id',
                'projects.name'
            )
            ->orderByRaw('MAX(attendances.date) DESC')
            ->orderBy('attendances.worker_name');

        $paginator = $summaryQuery
            ->paginate($perPage)
            ->withQueryString();

        $rows = collect($paginator->items())
            ->map(fn ($row) => [
                'worker_name' => $row->worker_name,
                'worker_role' => $row->worker_role,
                'foreman_name' => $row->foreman_name,
                'project_name' => $row->project_name,
                'logs_count' => (int) $row->logs_count,
                'days_count' => (int) $row->days_count,
                'total_hours' => round((float) $row->total_hours, 1),
                'first_date' => $row->first_date,
                'last_date' => $row->last_date,
            ])
            ->values();

        return Inertia::render($this->rolePage($request, 'Summary'), [
            'rows' => $rows,
            'summaryTable' => $this->tableMeta($paginator, $search),
            'filters' => $filters,
            'foremen' => $this->foremanOptions(),
            'projects' => $this->projectOptions(),
            'workerRoles' => $this->workerRoleOptions(),
            'attendanceCodes' => $this->attendanceCodeOptions(),
            'summaryTotals' => $summaryTotals,
        ]);
    }

    private function authorizeRole(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);
    }

    private function rolePage(Request $request, string $suffix): string
    {
        return $request->user()->role === 'head_admin'
            ? "HeadAdmin/Attendance/{$suffix}"
            : "Admin/Attendance/{$suffix}";
    }

    private function foremanOptions()
    {
        return User::query()
            ->where('role', 'foreman')
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $user) => ['id' => $user->id, 'fullname' => $user->fullname])
            ->values();
    }

    private function projectOptions()
    {
        return Project::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Project $project) => ['id' => $project->id, 'name' => $project->name])
            ->values();
    }

    private function workerRoleOptions()
    {
        return Attendance::query()
            ->whereNotNull('worker_role')
            ->where('worker_role', '!=', '')
            ->select('worker_role')
            ->distinct()
            ->orderBy('worker_role')
            ->pluck('worker_role')
            ->values();
    }

    private function attendanceCodeOptions()
    {
        return collect(self::ATTENDANCE_CODES)->values();
    }

    private function filtersFromRequest(Request $request): array
    {
        $entryMode = trim((string) $request->query('entry_mode', ''));
        if (!in_array($entryMode, [self::ENTRY_MODE_TIME_LOG, self::ENTRY_MODE_STATUS_BASED], true)) {
            $entryMode = '';
        }

        $attendanceCode = strtoupper(trim((string) $request->query('attendance_code', '')));
        if (!in_array($attendanceCode, self::ATTENDANCE_CODES, true)) {
            $attendanceCode = '';
        }

        return [
            'date_from' => $request->query('date_from') ?: '',
            'date_to' => $request->query('date_to') ?: '',
            'foreman_id' => $request->query('foreman_id') ?: '',
            'project_id' => $request->query('project_id') ?: '',
            'worker_role' => trim((string) ($request->query('worker_role') ?: '')),
            'entry_mode' => $entryMode,
            'attendance_code' => $attendanceCode,
        ];
    }

    private function applyAttendanceFilters(Builder $query, array $filters, string $search): void
    {
        if ($filters['date_from']) {
            $query->whereDate('date', '>=', $filters['date_from']);
        }
        if ($filters['date_to']) {
            $query->whereDate('date', '<=', $filters['date_to']);
        }
        if ($filters['foreman_id']) {
            $query->where('foreman_id', $filters['foreman_id']);
        }
        if ($filters['project_id']) {
            $query->where('project_id', $filters['project_id']);
        }
        if ($filters['worker_role']) {
            $query->where('worker_role', $filters['worker_role']);
        }
        if ($filters['attendance_code']) {
            $query->where('attendance_code', $filters['attendance_code']);
        }

        $this->applyEntryModeFilter($query, $filters['entry_mode'], 'time_in', 'time_out');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('worker_name', 'like', "%{$search}%")
                    ->orWhere('worker_role', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }
    }

    private function applyAttendanceFilterJoins($query, array $filters, string $search): void
    {
        if ($filters['date_from']) {
            $query->whereDate('attendances.date', '>=', $filters['date_from']);
        }
        if ($filters['date_to']) {
            $query->whereDate('attendances.date', '<=', $filters['date_to']);
        }
        if ($filters['foreman_id']) {
            $query->where('attendances.foreman_id', $filters['foreman_id']);
        }
        if ($filters['project_id']) {
            $query->where('attendances.project_id', $filters['project_id']);
        }
        if ($filters['worker_role']) {
            $query->where('attendances.worker_role', $filters['worker_role']);
        }
        if ($filters['attendance_code']) {
            $query->where('attendances.attendance_code', $filters['attendance_code']);
        }

        $this->applyEntryModeFilter($query, $filters['entry_mode'], 'attendances.time_in', 'attendances.time_out');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('attendances.worker_name', 'like', "%{$search}%")
                    ->orWhere('attendances.worker_role', 'like', "%{$search}%")
                    ->orWhere('foremen.fullname', 'like', "%{$search}%")
                    ->orWhere('projects.name', 'like', "%{$search}%");
            });
        }
    }

    private function applyEntryModeFilter($query, string $entryMode, string $timeInColumn, string $timeOutColumn): void
    {
        if ($entryMode === self::ENTRY_MODE_TIME_LOG) {
            $query->where(function ($builder) use ($timeInColumn, $timeOutColumn) {
                $builder->whereNotNull($timeInColumn)->orWhereNotNull($timeOutColumn);
            });
            return;
        }

        if ($entryMode === self::ENTRY_MODE_STATUS_BASED) {
            $query->whereNull($timeInColumn)->whereNull($timeOutColumn);
        }
    }

    private function resolveEntryMode(Attendance $attendance): string
    {
        $timeIn = trim((string) ($attendance->time_in ?? ''));
        $timeOut = trim((string) ($attendance->time_out ?? ''));

        return ($timeIn !== '' || $timeOut !== '')
            ? self::ENTRY_MODE_TIME_LOG
            : self::ENTRY_MODE_STATUS_BASED;
    }

    private function resolveAttendanceCode(Attendance $attendance, string $entryMode): array
    {
        $storedCode = strtoupper(trim((string) ($attendance->attendance_code ?? '')));
        if (in_array($storedCode, self::ATTENDANCE_CODES, true)) {
            return ['value' => $storedCode, 'is_derived' => false];
        }

        if ($entryMode === self::ENTRY_MODE_TIME_LOG) {
            return ['value' => null, 'is_derived' => false];
        }

        $hours = (float) ($attendance->hours ?? 0);
        if ($hours >= 7.5) {
            return ['value' => 'P', 'is_derived' => true];
        }
        if ($hours >= 3.5) {
            return ['value' => 'H', 'is_derived' => true];
        }
        if ($hours <= 0) {
            return ['value' => 'A/R/F', 'is_derived' => true];
        }

        return ['value' => null, 'is_derived' => true];
    }

    private function tableMeta($paginator, string $search): array
    {
        return [
            'search' => $search,
            'per_page' => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page' => max(1, $paginator->lastPage()),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }
}
