<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AttendanceController extends Controller
{
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
            ->map(fn (Attendance $attendance) => [
                'id' => $attendance->id,
                'date' => optional($attendance->date)?->toDateString(),
                'worker_name' => $attendance->worker_name,
                'worker_role' => $attendance->worker_role,
                'foreman_name' => $attendance->foreman?->fullname,
                'project_id' => $attendance->project_id,
                'project_name' => $attendance->project?->name,
                'time_in' => $attendance->time_in,
                'time_out' => $attendance->time_out,
                'hours' => (float) ($attendance->hours ?? 0),
                'selfie_path' => $attendance->selfie_path,
                'created_at' => optional($attendance->created_at)?->toDateTimeString(),
            ])
            ->values();

        return Inertia::render($this->rolePage($request, 'Index'), [
            'attendances' => $attendances,
            'attendanceTable' => $this->tableMeta($paginator, $search),
            'filters' => $filters,
            'foremen' => $this->foremanOptions(),
            'projects' => $this->projectOptions(),
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

    private function filtersFromRequest(Request $request): array
    {
        return [
            'date_from' => $request->query('date_from') ?: '',
            'date_to' => $request->query('date_to') ?: '',
            'foreman_id' => $request->query('foreman_id') ?: '',
            'project_id' => $request->query('project_id') ?: '',
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
