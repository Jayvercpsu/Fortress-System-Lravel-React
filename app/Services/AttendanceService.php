<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\User;
use App\Repositories\Contracts\AttendanceRepositoryInterface;
use App\Support\ProjectSelection;
use Illuminate\Http\Request;

class AttendanceService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly AttendanceRepositoryInterface $attendanceRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function pageByRole(User $user, string $suffix): string
    {
        return $user->role === User::ROLE_HEAD_ADMIN
            ? "HeadAdmin/Attendance/{$suffix}"
            : "Admin/Attendance/{$suffix}";
    }

    public function indexPayload(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        $filters = $this->filtersFromRequest($request);
        $projectFamilyIds = ProjectSelection::familyIdsFor(
            $filters['project_id'] !== '' ? (int) $filters['project_id'] : null
        );

        $paginator = $this->attendanceRepository->paginateAttendances(
            $filters,
            $search,
            $projectFamilyIds,
            $perPage
        );

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
                        ? $attendance->created_at->copy()->timezone(Attendance::PH_TIMEZONE)->format('Y-m-d h:i:s A')
                        : null,
                ];
            })
            ->values();

        return [
            'attendances' => $attendances,
            'attendanceTable' => $this->tableMeta($paginator, $search),
            'filters' => $filters,
            'foremen' => $this->attendanceRepository->foremanOptions(),
            'projects' => ProjectSelection::familyFilterOptions()->values(),
            'workerRoles' => $this->attendanceRepository->workerRoleOptions(),
            'attendanceCodes' => collect(Attendance::codes())->values(),
        ];
    }

    public function summaryPayload(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        $filters = $this->filtersFromRequest($request);
        $projectFamilyIds = ProjectSelection::familyIdsFor(
            $filters['project_id'] !== '' ? (int) $filters['project_id'] : null
        );

        $summaryTotals = $this->attendanceRepository->attendanceSummaryTotals($filters, $search, $projectFamilyIds);
        $paginator = $this->attendanceRepository->paginateAttendanceSummary(
            $filters,
            $search,
            $projectFamilyIds,
            $perPage
        );

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

        return [
            'rows' => $rows,
            'summaryTable' => $this->tableMeta($paginator, $search),
            'filters' => $filters,
            'foremen' => $this->attendanceRepository->foremanOptions(),
            'projects' => ProjectSelection::familyFilterOptions()->values(),
            'workerRoles' => $this->attendanceRepository->workerRoleOptions(),
            'attendanceCodes' => collect(Attendance::codes())->values(),
            'summaryTotals' => $summaryTotals,
        ];
    }

    private function filtersFromRequest(Request $request): array
    {
        $entryMode = trim((string) $request->query('entry_mode', ''));
        if (!in_array($entryMode, [Attendance::ENTRY_MODE_TIME_LOG, Attendance::ENTRY_MODE_STATUS_BASED], true)) {
            $entryMode = '';
        }

        $attendanceCode = strtoupper(trim((string) $request->query('attendance_code', '')));
        if (!in_array($attendanceCode, Attendance::codes(), true)) {
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

    private function resolveEntryMode(Attendance $attendance): string
    {
        $timeIn = trim((string) ($attendance->time_in ?? ''));
        $timeOut = trim((string) ($attendance->time_out ?? ''));

        return ($timeIn !== '' || $timeOut !== '')
            ? Attendance::ENTRY_MODE_TIME_LOG
            : Attendance::ENTRY_MODE_STATUS_BASED;
    }

    private function resolveAttendanceCode(Attendance $attendance, string $entryMode): array
    {
        $storedCode = strtoupper(trim((string) ($attendance->attendance_code ?? '')));
        if (in_array($storedCode, Attendance::codes(), true)) {
            return ['value' => $storedCode, 'is_derived' => false];
        }

        if ($entryMode === Attendance::ENTRY_MODE_TIME_LOG) {
            return ['value' => null, 'is_derived' => false];
        }

        $hours = (float) ($attendance->hours ?? 0);
        if ($hours >= 7.5) {
            return ['value' => Attendance::CODE_PRESENT, 'is_derived' => true];
        }
        if ($hours >= 3.5) {
            return ['value' => Attendance::CODE_HALF_DAY, 'is_derived' => true];
        }
        if ($hours <= 0) {
            return ['value' => Attendance::DERIVED_ZERO_HOURS_LABEL, 'is_derived' => true];
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
