<?php

namespace App\Repositories;

use App\Models\Attendance;
use App\Models\User;
use App\Repositories\Contracts\AttendanceRepositoryInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class AttendanceRepository implements AttendanceRepositoryInterface
{
    public function paginateAttendances(
        array $filters,
        string $search,
        array $projectFamilyIds,
        int $perPage
    ): LengthAwarePaginator {
        $query = Attendance::query()
            ->with(['foreman:id,fullname', 'project:id,name']);

        $this->applyAttendanceFilters($query, $filters, $search, $projectFamilyIds);

        return $query
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function paginateAttendanceSummary(
        array $filters,
        string $search,
        array $projectFamilyIds,
        int $perPage
    ): LengthAwarePaginator {
        $base = Attendance::query()
            ->leftJoin('users as foremen', 'foremen.id', '=', 'attendances.foreman_id')
            ->leftJoin('projects', 'projects.id', '=', 'attendances.project_id');

        $this->applyAttendanceFilterJoins($base, $filters, $search, $projectFamilyIds);

        return $base
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
            ->orderBy('attendances.worker_name')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function attendanceSummaryTotals(array $filters, string $search, array $projectFamilyIds): array
    {
        $base = Attendance::query()
            ->leftJoin('users as foremen', 'foremen.id', '=', 'attendances.foreman_id')
            ->leftJoin('projects', 'projects.id', '=', 'attendances.project_id');

        $this->applyAttendanceFilterJoins($base, $filters, $search, $projectFamilyIds);

        $totalsBase = clone $base;

        return [
            'total_logs' => (int) (clone $totalsBase)->count('attendances.id'),
            'total_hours' => round((float) ((clone $totalsBase)->sum('attendances.hours') ?? 0), 1),
            'unique_workers' => (int) (clone $totalsBase)->distinct('attendances.worker_name')->count('attendances.worker_name'),
            'unique_foremen' => (int) (clone $totalsBase)->distinct('attendances.foreman_id')->count('attendances.foreman_id'),
        ];
    }

    public function foremanOptions(): Collection
    {
        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $user) => ['id' => $user->id, 'fullname' => $user->fullname])
            ->values();
    }

    public function workerRoleOptions(): Collection
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

    private function applyAttendanceFilters(Builder $query, array $filters, string $search, array $projectFamilyIds = []): void
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
        if (!empty($projectFamilyIds)) {
            $query->whereIn('project_id', $projectFamilyIds);
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

    private function applyAttendanceFilterJoins($query, array $filters, string $search, array $projectFamilyIds = []): void
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
        if (!empty($projectFamilyIds)) {
            $query->whereIn('attendances.project_id', $projectFamilyIds);
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
        if ($entryMode === Attendance::ENTRY_MODE_TIME_LOG) {
            $query->where(function ($builder) use ($timeInColumn, $timeOutColumn) {
                $builder->whereNotNull($timeInColumn)->orWhereNotNull($timeOutColumn);
            });

            return;
        }

        if ($entryMode === Attendance::ENTRY_MODE_STATUS_BASED) {
            $query->whereNull($timeInColumn)->whereNull($timeOutColumn);
        }
    }
}
