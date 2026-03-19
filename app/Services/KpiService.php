<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\User;
use App\Models\Worker;
use App\Repositories\Contracts\KpiRepositoryInterface;
use App\Support\ProjectSelection;
use App\Models\WeeklyAccomplishment;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Inertia\Inertia;

class KpiService
{
    private const DEFAULT_WORKER_HOURS_PCT = 70;
    private const DEFAULT_WORKER_DAYS_PCT = 30;
    private const DEFAULT_FOREMAN_ATTENDANCE_PCT = 40;
    private const DEFAULT_FOREMAN_PROGRESS_PCT = 40;
    private const DEFAULT_FOREMAN_ACTIVITY_PCT = 20;
    private const DEFAULT_FOREMAN_ATTENDANCE_HOURS_PCT = 70;
    private const DEFAULT_FOREMAN_ATTENDANCE_DAYS_PCT = 30;
    private const DEFAULT_FOREMAN_PROGRESS_AVG_PCT = 70;
    private const DEFAULT_FOREMAN_PROGRESS_SCOPES_PCT = 30;
    private const DEFAULT_FOREMAN_ACTIVITY_ISSUES_PCT = 25;
    private const DEFAULT_FOREMAN_ACTIVITY_MATERIALS_PCT = 25;
    private const DEFAULT_FOREMAN_ACTIVITY_DELIVERIES_PCT = 25;
    private const DEFAULT_FOREMAN_ACTIVITY_PHOTOS_PCT = 25;
    private const DEFAULT_PROMOTION_READY = 85;
    private const DEFAULT_PROMOTION_TRACK = 70;

    public function __construct(
        private readonly KpiRepositoryInterface $kpiRepository
    ) {
    }

    public function index(Request $request)
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_HEAD_ADMIN, User::ROLE_ADMIN, User::ROLE_HR], true), 403);

        $payload = $this->buildPayload($request);

        $page = match ($request->user()->role) {
            User::ROLE_HEAD_ADMIN => 'HeadAdmin/Kpi',
            User::ROLE_ADMIN => 'Admin/Kpi',
            default => 'HR/Kpi',
        };

        return Inertia::render($page, $payload);
    }

    public function print(Request $request)
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_HEAD_ADMIN, User::ROLE_ADMIN, User::ROLE_HR], true), 403);

        $payload = $this->buildPayload($request);

        $page = match ($request->user()->role) {
            User::ROLE_HEAD_ADMIN => 'HeadAdmin/KpiPrint',
            User::ROLE_ADMIN => 'Admin/KpiPrint',
            default => 'HR/KpiPrint',
        };

        return Inertia::render($page, $payload);
    }

    public function export(Request $request)
    {
        abort_unless(in_array($request->user()->role, [User::ROLE_HEAD_ADMIN, User::ROLE_ADMIN, User::ROLE_HR], true), 403);

        $payload = $this->buildPayload($request);
        $csv = $this->buildCsv($payload);

        $filename = 'kpi-' . now()->format('Y-m-d') . '.csv';

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    private function buildPayload(Request $request): array
    {
        $filters = [
            'date_from' => trim((string) $request->query('date_from', '')),
            'date_to' => trim((string) $request->query('date_to', '')),
            'project_id' => trim((string) $request->query('project_id', '')),
            'delivery_date_basis' => trim((string) $request->query('delivery_date_basis', '')),
        ];

        $scoreConfig = $this->resolveScoreConfig($request);

        $dateFrom = $this->parseDate($filters['date_from']);
        $dateTo = $this->parseDate($filters['date_to'], true);
        $projectId = $filters['project_id'] !== '' ? (int) $filters['project_id'] : null;
        $projectFamilyIds = ProjectSelection::familyIdsFor($projectId);
        $deliveryDateBasis = $filters['delivery_date_basis'] !== '' ? $filters['delivery_date_basis'] : 'created_at';
        if (!in_array($deliveryDateBasis, ['created_at', 'delivery_date'], true)) {
            $deliveryDateBasis = 'created_at';
        }
        $filters['delivery_date_basis'] = $deliveryDateBasis;

        $attendanceQuery = $this->kpiRepository->attendances();
        if (!empty($projectFamilyIds)) {
            $attendanceQuery->whereIn('project_id', $projectFamilyIds);
        }
        $attendanceRows = $attendanceQuery
            ->when($dateFrom, fn ($query) => $query->whereDate('date', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('date', '<=', $dateTo))
            ->get([
                'foreman_id',
                'project_id',
                'worker_name',
                'worker_role',
                'date',
                'hours',
                'attendance_code',
            ]);

        $weeklyQuery = $this->kpiRepository->weeklyAccomplishments();
        if (!empty($projectFamilyIds)) {
            $weeklyQuery->whereIn('project_id', $projectFamilyIds);
        }
        $weeklyRows = $weeklyQuery
            ->when($dateFrom, fn ($query) => $query->whereDate('week_start', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('week_start', '<=', $dateTo))
            ->get([
                'foreman_id',
                'project_id',
                'week_start',
                'percent_completed',
            ]);

        $issueQuery = $this->kpiRepository->issueReports();
        if (!empty($projectFamilyIds)) {
            $issueQuery->whereIn('project_id', $projectFamilyIds);
        }
        $issueRows = $issueQuery
            ->when($dateFrom, fn ($query) => $query->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('created_at', '<=', $dateTo))
            ->get([
                'foreman_id',
                'project_id',
                'created_at',
            ]);

        $materialQuery = $this->kpiRepository->materialRequests();
        if (!empty($projectFamilyIds)) {
            $materialQuery->whereIn('project_id', $projectFamilyIds);
        }
        $materialRows = $materialQuery
            ->when($dateFrom, fn ($query) => $query->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('created_at', '<=', $dateTo))
            ->get([
                'foreman_id',
                'project_id',
                'created_at',
            ]);

        $deliveryDateColumn = $deliveryDateBasis === 'delivery_date' ? 'delivery_date' : 'created_at';
        $deliveryQuery = $this->kpiRepository->deliveries();
        if (!empty($projectFamilyIds)) {
            $deliveryQuery->whereIn('project_id', $projectFamilyIds);
        }
        $deliveryRows = $deliveryQuery
            ->when($dateFrom, fn ($query) => $query->whereDate($deliveryDateColumn, '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate($deliveryDateColumn, '<=', $dateTo))
            ->get([
                'foreman_id',
                'project_id',
                'created_at',
            ]);

        $progressPhotoQuery = $this->kpiRepository->progressPhotos();
        if (!empty($projectFamilyIds)) {
            $progressPhotoQuery->whereIn('project_id', $projectFamilyIds);
        }
        $progressPhotoRows = $progressPhotoQuery
            ->when($dateFrom, fn ($query) => $query->whereDate('created_at', '>=', $dateFrom))
            ->when($dateTo, fn ($query) => $query->whereDate('created_at', '<=', $dateTo))
            ->get([
                'foreman_id',
                'project_id',
                'created_at',
            ]);

        $projectRootIdByProjectId = ProjectSelection::rootIdMapForIds(
            $attendanceRows->pluck('project_id')
                ->merge($weeklyRows->pluck('project_id'))
                ->merge($issueRows->pluck('project_id'))
                ->merge($materialRows->pluck('project_id'))
                ->merge($deliveryRows->pluck('project_id'))
                ->merge($progressPhotoRows->pluck('project_id'))
                ->filter()
                ->all()
        );

        $foremanIds = $attendanceRows->pluck('foreman_id')
            ->merge($weeklyRows->pluck('foreman_id'))
            ->merge($issueRows->pluck('foreman_id'))
            ->merge($materialRows->pluck('foreman_id'))
            ->merge($deliveryRows->pluck('foreman_id'))
            ->merge($progressPhotoRows->pluck('foreman_id'))
            ->filter()
            ->unique()
            ->values();

        $foremanNameById = $foremanIds->isNotEmpty()
            ? $this->kpiRepository->users()->whereIn('id', $foremanIds->all())->pluck('fullname', 'id')->all()
            : [];

        $workerKpis = $this->buildWorkerKpis($attendanceRows, $foremanNameById, $scoreConfig['weights']['worker'], $projectRootIdByProjectId);
        $foremanKpis = $this->buildForemanKpis(
            $attendanceRows,
            $weeklyRows,
            $issueRows,
            $materialRows,
            $deliveryRows,
            $progressPhotoRows,
            $foremanNameById,
            $scoreConfig['weights']['foreman'],
            $projectRootIdByProjectId
        );
        $summary = $this->buildSummary($workerKpis, $foremanKpis);

        $projects = ProjectSelection::familyFilterOptions()
            ->values()
            ->all();

        return [
            'filters' => $filters,
            'projects' => $projects,
            'summary' => $summary,
            'workerKpis' => $workerKpis->values()->all(),
            'foremanKpis' => $foremanKpis->values()->all(),
            'topWorkers' => $workerKpis->take(5)->values()->all(),
            'topForemen' => $foremanKpis->take(5)->values()->all(),
            'scoreWeights' => $scoreConfig['weights'],
            'promotionThresholds' => $scoreConfig['thresholds'],
        ];
    }

    private function resolveScoreConfig(Request $request): array
    {
        $workerRaw = [
            'hours' => $this->parsePercentInput($request->query('worker_hours'), self::DEFAULT_WORKER_HOURS_PCT),
            'days' => $this->parsePercentInput($request->query('worker_days'), self::DEFAULT_WORKER_DAYS_PCT),
        ];

        $foremanTopRaw = [
            'attendance' => $this->parsePercentInput($request->query('foreman_attendance'), self::DEFAULT_FOREMAN_ATTENDANCE_PCT),
            'progress' => $this->parsePercentInput($request->query('foreman_progress'), self::DEFAULT_FOREMAN_PROGRESS_PCT),
            'activity' => $this->parsePercentInput($request->query('foreman_activity'), self::DEFAULT_FOREMAN_ACTIVITY_PCT),
        ];

        $foremanAttendanceRaw = [
            'hours' => $this->parsePercentInput($request->query('foreman_attendance_hours'), self::DEFAULT_FOREMAN_ATTENDANCE_HOURS_PCT),
            'days' => $this->parsePercentInput($request->query('foreman_attendance_days'), self::DEFAULT_FOREMAN_ATTENDANCE_DAYS_PCT),
        ];

        $foremanProgressRaw = [
            'avg' => $this->parsePercentInput($request->query('foreman_progress_avg'), self::DEFAULT_FOREMAN_PROGRESS_AVG_PCT),
            'scopes' => $this->parsePercentInput($request->query('foreman_progress_scopes'), self::DEFAULT_FOREMAN_PROGRESS_SCOPES_PCT),
        ];

        $foremanActivityRaw = [
            'issues' => $this->parsePercentInput($request->query('foreman_activity_issues'), self::DEFAULT_FOREMAN_ACTIVITY_ISSUES_PCT),
            'materials' => $this->parsePercentInput($request->query('foreman_activity_materials'), self::DEFAULT_FOREMAN_ACTIVITY_MATERIALS_PCT),
            'deliveries' => $this->parsePercentInput($request->query('foreman_activity_deliveries'), self::DEFAULT_FOREMAN_ACTIVITY_DELIVERIES_PCT),
            'photos' => $this->parsePercentInput($request->query('foreman_activity_photos'), self::DEFAULT_FOREMAN_ACTIVITY_PHOTOS_PCT),
        ];

        $workerWeights = $this->normalizePercentWeights($workerRaw, [
            'hours' => self::DEFAULT_WORKER_HOURS_PCT,
            'days' => self::DEFAULT_WORKER_DAYS_PCT,
        ]);
        $foremanTopWeights = $this->normalizePercentWeights($foremanTopRaw, [
            'attendance' => self::DEFAULT_FOREMAN_ATTENDANCE_PCT,
            'progress' => self::DEFAULT_FOREMAN_PROGRESS_PCT,
            'activity' => self::DEFAULT_FOREMAN_ACTIVITY_PCT,
        ]);
        $foremanAttendanceWeights = $this->normalizePercentWeights($foremanAttendanceRaw, [
            'hours' => self::DEFAULT_FOREMAN_ATTENDANCE_HOURS_PCT,
            'days' => self::DEFAULT_FOREMAN_ATTENDANCE_DAYS_PCT,
        ]);
        $foremanProgressWeights = $this->normalizePercentWeights($foremanProgressRaw, [
            'avg' => self::DEFAULT_FOREMAN_PROGRESS_AVG_PCT,
            'scopes' => self::DEFAULT_FOREMAN_PROGRESS_SCOPES_PCT,
        ]);
        $foremanActivityWeights = $this->normalizePercentWeights($foremanActivityRaw, [
            'issues' => self::DEFAULT_FOREMAN_ACTIVITY_ISSUES_PCT,
            'materials' => self::DEFAULT_FOREMAN_ACTIVITY_MATERIALS_PCT,
            'deliveries' => self::DEFAULT_FOREMAN_ACTIVITY_DELIVERIES_PCT,
            'photos' => self::DEFAULT_FOREMAN_ACTIVITY_PHOTOS_PCT,
        ]);

        $promotionReady = $this->parsePercentInput($request->query('promotion_ready'), self::DEFAULT_PROMOTION_READY);
        $promotionTrack = $this->parsePercentInput($request->query('promotion_track'), self::DEFAULT_PROMOTION_TRACK);

        if ($promotionReady < $promotionTrack) {
            $swap = $promotionReady;
            $promotionReady = $promotionTrack;
            $promotionTrack = $swap;
        }

        return [
            'weights' => [
                'worker' => [
                    'hours' => $workerWeights['weights']['hours'],
                    'days' => $workerWeights['weights']['days'],
                ],
                'foreman' => [
                    'attendance' => $foremanTopWeights['weights']['attendance'],
                    'progress' => $foremanTopWeights['weights']['progress'],
                    'activity' => $foremanTopWeights['weights']['activity'],
                    'attendance_hours' => $foremanAttendanceWeights['weights']['hours'],
                    'attendance_days' => $foremanAttendanceWeights['weights']['days'],
                    'progress_avg' => $foremanProgressWeights['weights']['avg'],
                    'progress_scopes' => $foremanProgressWeights['weights']['scopes'],
                    'activity_issues' => $foremanActivityWeights['weights']['issues'],
                    'activity_materials' => $foremanActivityWeights['weights']['materials'],
                    'activity_deliveries' => $foremanActivityWeights['weights']['deliveries'],
                    'activity_photos' => $foremanActivityWeights['weights']['photos'],
                ],
            ],
            'thresholds' => [
                'promotion_ready' => round($promotionReady, 1),
                'promotion_track' => round($promotionTrack, 1),
            ],
        ];
    }

    private function normalizePercentWeights(array $rawWeights, array $defaults): array
    {
        $clean = [];
        foreach ($defaults as $key => $default) {
            $value = $rawWeights[$key] ?? $default;
            if (!is_numeric($value)) {
                $value = $default;
            }

            $value = (float) $value;
            if (!is_finite($value)) {
                $value = (float) $default;
            }

            $clean[$key] = max(0, min(100, $value));
        }

        $sum = array_sum($clean);
        if ($sum <= 0) {
            $clean = $defaults;
            $sum = array_sum($clean);
        }

        $weights = [];
        foreach ($clean as $key => $value) {
            $weights[$key] = $sum > 0 ? round($value / $sum, 4) : 0;
        }

        return [
            'weights' => $weights,
        ];
    }

    private function parsePercentInput($value, float $fallback): float
    {
        if ($value === null || $value === '') {
            return $fallback;
        }

        if (!is_numeric($value)) {
            return $fallback;
        }

        $numeric = (float) $value;
        if (!is_finite($numeric)) {
            return $fallback;
        }

        return max(0, min(100, $numeric));
    }

    private function parseDate(string $value, bool $endOfDay = false): ?Carbon
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        try {
            $date = Carbon::createFromFormat('Y-m-d', $trimmed);
        } catch (\Exception $e) {
            return null;
        }

        return $endOfDay ? $date->endOfDay() : $date->startOfDay();
    }

    private function buildWorkerKpis(Collection $attendanceRows, array $foremanNameById, array $weights, array $projectRootIdByProjectId = []): Collection
    {
        $workerGroups = $attendanceRows
            ->filter(function (Attendance $row) {
                $name = trim((string) ($row->worker_name ?? ''));
                if ($name === '') {
                    return false;
                }

                return !$this->isForemanRole($row->worker_role);
            })
            ->groupBy(fn (Attendance $row) => Str::lower(trim((string) $row->worker_name)));

        $rows = $workerGroups->map(function (Collection $rows) use ($foremanNameById) {
            $displayName = $rows->pluck('worker_name')->filter()->unique()->values()->first() ?? 'Unknown';
            $roleCounts = $rows->pluck('worker_role')
                ->map(fn ($role) => trim((string) $role))
                ->filter()
                ->countBy()
                ->sortByDesc(fn ($count) => $count);
            $role = $roleCounts->keys()->first() ?? Worker::JOB_TYPE_WORKER;

            $foremanNames = $rows->pluck('foreman_id')
                ->filter()
                ->map(fn ($id) => $foremanNameById[$id] ?? null)
                ->filter()
                ->unique()
                ->values();

            $attendanceDays = $rows->pluck('date')
                ->filter()
                ->map(fn ($date) => $date instanceof Carbon ? $date->toDateString() : (string) $date)
                ->unique()
                ->count();

            $lastAttendance = $rows->pluck('date')
                ->filter()
                ->sortByDesc(fn ($date) => $date instanceof Carbon ? $date->timestamp : 0)
                ->first();

            return [
                'worker_name' => $displayName,
                'worker_role' => $role,
                'foreman_name' => $foremanNames->count() > 1
                    ? 'Multiple'
                    : ($foremanNames->first() ?? 'Unassigned'),
                'projects_count' => $rows->pluck('project_id')
                    ->filter()
                    ->map(fn ($id) => $projectRootIdByProjectId[(int) $id] ?? (int) $id)
                    ->unique()
                    ->count(),
                'attendance_days' => $attendanceDays,
                'attendance_hours' => round((float) $rows->sum(fn ($row) => (float) ($row->hours ?? 0)), 1),
                'last_attendance' => $lastAttendance instanceof Carbon ? $lastAttendance->toDateString() : null,
            ];
        })->values();

        $maxHours = max(1, (float) $rows->max('attendance_hours'));
        $maxDays = max(1, (int) $rows->max('attendance_days'));

        $hoursWeight = (float) ($weights['hours'] ?? self::DEFAULT_WORKER_HOURS_PCT / 100);
        $daysWeight = (float) ($weights['days'] ?? self::DEFAULT_WORKER_DAYS_PCT / 100);

        return $rows->map(function (array $row) use ($maxHours, $maxDays, $hoursWeight, $daysWeight) {
            $hoursScore = $maxHours > 0 ? ($row['attendance_hours'] / $maxHours) * 100 : 0;
            $daysScore = $maxDays > 0 ? ($row['attendance_days'] / $maxDays) * 100 : 0;
            $attendanceScore = ($hoursScore * $hoursWeight) + ($daysScore * $daysWeight);

            $row['attendance_score'] = round($attendanceScore, 1);
            $row['kpi_score'] = round($attendanceScore, 1);

            return $row;
        })
        ->sortByDesc('kpi_score')
        ->values();
    }

    private function buildForemanKpis(
        Collection $attendanceRows,
        Collection $weeklyRows,
        Collection $issueRows,
        Collection $materialRows,
        Collection $deliveryRows,
        Collection $progressPhotoRows,
        array $foremanNameById,
        array $weights,
        array $projectRootIdByProjectId = []
    ): Collection
    {
        $foremanAttendance = $attendanceRows->filter(function (Attendance $row) use ($foremanNameById) {
            if ($this->isForemanRole($row->worker_role)) {
                return true;
            }

            $foremanId = (int) ($row->foreman_id ?? 0);
            if (!$foremanId) {
                return false;
            }

            $foremanName = trim((string) ($foremanNameById[$foremanId] ?? ''));
            if ($foremanName === '') {
                return false;
            }

            $workerName = trim((string) ($row->worker_name ?? ''));
            if ($workerName === '') {
                return false;
            }

            return Str::lower($workerName) === Str::lower($foremanName);
        });

        $attendanceByForeman = $foremanAttendance->groupBy(fn (Attendance $row) => (int) ($row->foreman_id ?? 0));
        $weeklyByForeman = $weeklyRows->groupBy(fn (WeeklyAccomplishment $row) => (int) ($row->foreman_id ?? 0));
        $issuesByForeman = $issueRows->groupBy(fn ($row) => (int) ($row->foreman_id ?? 0));
        $materialsByForeman = $materialRows->groupBy(fn ($row) => (int) ($row->foreman_id ?? 0));
        $deliveriesByForeman = $deliveryRows->groupBy(fn ($row) => (int) ($row->foreman_id ?? 0));
        $photosByForeman = $progressPhotoRows->groupBy(fn ($row) => (int) ($row->foreman_id ?? 0));

        $foremanIds = collect($attendanceByForeman->keys())
            ->merge($weeklyByForeman->keys())
            ->merge($issuesByForeman->keys())
            ->merge($materialsByForeman->keys())
            ->merge($deliveriesByForeman->keys())
            ->merge($photosByForeman->keys())
            ->filter()
            ->unique()
            ->values();

        $rows = $foremanIds->map(function ($foremanId) use ($attendanceByForeman, $weeklyByForeman, $issuesByForeman, $materialsByForeman, $deliveriesByForeman, $photosByForeman, $foremanNameById) {
            $attendanceRows = $attendanceByForeman->get($foremanId, collect());
            $weeklyRows = $weeklyByForeman->get($foremanId, collect());
            $issueRows = $issuesByForeman->get($foremanId, collect());
            $materialRows = $materialsByForeman->get($foremanId, collect());
            $deliveryRows = $deliveriesByForeman->get($foremanId, collect());
            $photoRows = $photosByForeman->get($foremanId, collect());

            $attendanceDays = $attendanceRows->pluck('date')
                ->filter()
                ->map(fn ($date) => $date instanceof Carbon ? $date->toDateString() : (string) $date)
                ->unique()
                ->count();

            $lastWeek = $weeklyRows->pluck('week_start')
                ->filter()
                ->sortByDesc(fn ($date) => $date instanceof Carbon ? $date->timestamp : 0)
                ->first();

            $projectCount = collect()
                ->merge($weeklyRows->pluck('project_id'))
                ->merge($attendanceRows->pluck('project_id'))
                ->merge($issueRows->pluck('project_id'))
                ->merge($materialRows->pluck('project_id'))
                ->merge($deliveryRows->pluck('project_id'))
                ->merge($photoRows->pluck('project_id'))
                ->filter()
                ->map(fn ($id) => $projectRootIdByProjectId[(int) $id] ?? (int) $id)
                ->unique()
                ->count();

            $issueCount = $issueRows->count();
            $materialCount = $materialRows->count();
            $deliveryCount = $deliveryRows->count();
            $photoCount = $photoRows->count();

            return [
                'foreman_id' => (int) $foremanId,
                'foreman_name' => $foremanNameById[$foremanId] ?? 'Unknown',
                'projects_count' => $projectCount,
                'attendance_days' => $attendanceDays,
                'attendance_hours' => round((float) $attendanceRows->sum(fn ($row) => (float) ($row->hours ?? 0)), 1),
                'weekly_scopes' => $weeklyRows->count(),
                'avg_percent_completed' => $weeklyRows->isNotEmpty()
                    ? round((float) $weeklyRows->avg(fn ($row) => (float) ($row->percent_completed ?? 0)), 1)
                    : 0.0,
                'issues_count' => $issueCount,
                'material_requests_count' => $materialCount,
                'deliveries_count' => $deliveryCount,
                'progress_photos_count' => $photoCount,
                'activity_uploads' => $issueCount + $materialCount + $deliveryCount + $photoCount,
                'latest_week_start' => $lastWeek instanceof Carbon ? $lastWeek->toDateString() : null,
            ];
        });

        $maxHours = max(1, (float) $rows->max('attendance_hours'));
        $maxDays = max(1, (int) $rows->max('attendance_days'));
        $maxScopes = max(1, (int) $rows->max('weekly_scopes'));
        $maxIssues = max(1, (int) $rows->max('issues_count'));
        $maxMaterials = max(1, (int) $rows->max('material_requests_count'));
        $maxDeliveries = max(1, (int) $rows->max('deliveries_count'));
        $maxPhotos = max(1, (int) $rows->max('progress_photos_count'));

        $attendanceWeight = (float) ($weights['attendance'] ?? self::DEFAULT_FOREMAN_ATTENDANCE_PCT / 100);
        $progressWeight = (float) ($weights['progress'] ?? self::DEFAULT_FOREMAN_PROGRESS_PCT / 100);
        $activityWeight = (float) ($weights['activity'] ?? self::DEFAULT_FOREMAN_ACTIVITY_PCT / 100);
        $attendanceHoursWeight = (float) ($weights['attendance_hours'] ?? self::DEFAULT_FOREMAN_ATTENDANCE_HOURS_PCT / 100);
        $attendanceDaysWeight = (float) ($weights['attendance_days'] ?? self::DEFAULT_FOREMAN_ATTENDANCE_DAYS_PCT / 100);
        $progressAvgWeight = (float) ($weights['progress_avg'] ?? self::DEFAULT_FOREMAN_PROGRESS_AVG_PCT / 100);
        $progressScopesWeight = (float) ($weights['progress_scopes'] ?? self::DEFAULT_FOREMAN_PROGRESS_SCOPES_PCT / 100);
        $activityIssuesWeight = (float) ($weights['activity_issues'] ?? self::DEFAULT_FOREMAN_ACTIVITY_ISSUES_PCT / 100);
        $activityMaterialsWeight = (float) ($weights['activity_materials'] ?? self::DEFAULT_FOREMAN_ACTIVITY_MATERIALS_PCT / 100);
        $activityDeliveriesWeight = (float) ($weights['activity_deliveries'] ?? self::DEFAULT_FOREMAN_ACTIVITY_DELIVERIES_PCT / 100);
        $activityPhotosWeight = (float) ($weights['activity_photos'] ?? self::DEFAULT_FOREMAN_ACTIVITY_PHOTOS_PCT / 100);

        return $rows->map(function (array $row) use (
            $maxHours,
            $maxDays,
            $maxScopes,
            $maxIssues,
            $maxMaterials,
            $maxDeliveries,
            $maxPhotos,
            $attendanceWeight,
            $progressWeight,
            $activityWeight,
            $attendanceHoursWeight,
            $attendanceDaysWeight,
            $progressAvgWeight,
            $progressScopesWeight,
            $activityIssuesWeight,
            $activityMaterialsWeight,
            $activityDeliveriesWeight,
            $activityPhotosWeight
        ) {
            $hoursScore = $maxHours > 0 ? ($row['attendance_hours'] / $maxHours) * 100 : 0;
            $daysScore = $maxDays > 0 ? ($row['attendance_days'] / $maxDays) * 100 : 0;
            $attendanceScore = ($hoursScore * $attendanceHoursWeight) + ($daysScore * $attendanceDaysWeight);

            $scopeScore = $maxScopes > 0 ? ($row['weekly_scopes'] / $maxScopes) * 100 : 0;
            $progressScore = ($row['avg_percent_completed'] * $progressAvgWeight) + ($scopeScore * $progressScopesWeight);

            $issueScore = $maxIssues > 0 ? ($row['issues_count'] / $maxIssues) * 100 : 0;
            $materialScore = $maxMaterials > 0 ? ($row['material_requests_count'] / $maxMaterials) * 100 : 0;
            $deliveryScore = $maxDeliveries > 0 ? ($row['deliveries_count'] / $maxDeliveries) * 100 : 0;
            $photoScore = $maxPhotos > 0 ? ($row['progress_photos_count'] / $maxPhotos) * 100 : 0;
            $activityScore = ($issueScore * $activityIssuesWeight)
                + ($materialScore * $activityMaterialsWeight)
                + ($deliveryScore * $activityDeliveriesWeight)
                + ($photoScore * $activityPhotosWeight);

            $kpiScore = ($attendanceScore * $attendanceWeight) + ($progressScore * $progressWeight) + ($activityScore * $activityWeight);

            $row['attendance_score'] = round($attendanceScore, 1);
            $row['progress_score'] = round($progressScore, 1);
            $row['activity_score'] = round($activityScore, 1);
            $row['kpi_score'] = round($kpiScore, 1);

            return $row;
        })
        ->sortByDesc('kpi_score')
        ->values();
    }

    private function buildSummary(Collection $workerKpis, Collection $foremanKpis): array
    {
        return [
            'total_workers' => $workerKpis->count(),
            'total_foremen' => $foremanKpis->count(),
            'average_worker_hours' => round((float) $workerKpis->avg('attendance_hours'), 1),
            'average_foreman_progress' => round((float) $foremanKpis->avg('avg_percent_completed'), 1),
            'average_worker_score' => round((float) $workerKpis->avg('kpi_score'), 1),
            'average_foreman_score' => round((float) $foremanKpis->avg('kpi_score'), 1),
            'top_worker_score' => round((float) data_get($workerKpis->first(), 'kpi_score', 0), 1),
            'top_foreman_score' => round((float) data_get($foremanKpis->first(), 'kpi_score', 0), 1),
        ];
    }

    private function buildCsv(array $payload): string
    {
        $workerRows = $payload['workerKpis'] ?? [];
        $foremanRows = $payload['foremanKpis'] ?? [];
        $thresholds = $payload['promotionThresholds'] ?? [
            'promotion_ready' => self::DEFAULT_PROMOTION_READY,
            'promotion_track' => self::DEFAULT_PROMOTION_TRACK,
        ];

        $headers = [
            'category',
            'name',
            'role',
            'foreman',
            'projects',
            'attendance_days',
            'attendance_hours',
            'weekly_scopes',
            'avg_progress',
            'issues_count',
            'material_requests_count',
            'deliveries_count',
            'progress_photos_count',
            'activity_uploads',
            'kpi_score',
            'promotion_label',
        ];

        $rows = [$headers];

        foreach ($workerRows as $row) {
            $rows[] = [
                'worker',
                $row['worker_name'] ?? '',
                $row['worker_role'] ?? '',
                $row['foreman_name'] ?? '',
                $row['projects_count'] ?? 0,
                $row['attendance_days'] ?? 0,
                $row['attendance_hours'] ?? 0,
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                $row['kpi_score'] ?? 0,
                $this->promotionLabel((float) ($row['kpi_score'] ?? 0), $thresholds),
            ];
        }

        foreach ($foremanRows as $row) {
            $rows[] = [
                'foreman',
                $row['foreman_name'] ?? '',
                Attendance::ROLE_FOREMAN,
                '',
                $row['projects_count'] ?? 0,
                $row['attendance_days'] ?? 0,
                $row['attendance_hours'] ?? 0,
                $row['weekly_scopes'] ?? 0,
                $row['avg_percent_completed'] ?? 0,
                $row['issues_count'] ?? 0,
                $row['material_requests_count'] ?? 0,
                $row['deliveries_count'] ?? 0,
                $row['progress_photos_count'] ?? 0,
                $row['activity_uploads'] ?? 0,
                $row['kpi_score'] ?? 0,
                $this->promotionLabel((float) ($row['kpi_score'] ?? 0), $thresholds),
            ];
        }

        $handle = fopen('php://temp', 'r+');
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    private function promotionLabel(float $score, array $thresholds): string
    {
        $ready = (float) ($thresholds['promotion_ready'] ?? self::DEFAULT_PROMOTION_READY);
        $track = (float) ($thresholds['promotion_track'] ?? self::DEFAULT_PROMOTION_TRACK);

        if ($score >= $ready) {
            return 'Promotion Ready';
        }
        if ($score >= $track) {
            return 'On Track';
        }
        return 'Needs Review';
    }

    private function isForemanRole(?string $role): bool
    {
        $normalized = Str::lower(trim((string) $role));
        if ($normalized === '') {
            return false;
        }

        return $normalized === Str::lower(Attendance::ROLE_FOREMAN)
            || Str::contains($normalized, Str::lower(Attendance::ROLE_FOREMAN));
    }
}

