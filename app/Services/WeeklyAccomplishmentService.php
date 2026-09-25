<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\WeeklyAccomplishmentRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class WeeklyAccomplishmentService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public const DETAIL_SUBMISSIONS_PER_PAGE = 50;

    public const DETAIL_PHOTOS_PER_PAGE = 21;

    public function __construct(
        private readonly WeeklyAccomplishmentRepositoryInterface $weeklyAccomplishmentRepository,
        private readonly PmProgressService $pmProgressService
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function indexPayload(Request $request): array
    {
        $this->weeklyAccomplishmentRepository->generateSkippedWeeksToCurrent();

        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 50);
        $status = trim((string) $request->query('status', ''));

        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 50;
        }

        $filters = [
            'project_id' => trim((string) $request->query('project_id', '')),
            'submitted_by' => trim((string) $request->query('submitted_by', '')),
            'week_from' => trim((string) $request->query('week_from', '')),
            'week_to' => trim((string) $request->query('week_to', '')),
            'date_from' => trim((string) $request->query('date_from', '')),
            'date_to' => trim((string) $request->query('date_to', '')),
        ];

        $hasActiveFilters = collect($filters)->contains(fn ($value) => $value !== '');

        $projects = collect();
        $paginator = null;
        $showEmptyProjects = $search === '' && $status === '' && !$hasActiveFilters;

        $isHeadAdminView = in_array($request->user()->role, [User::ROLE_HEAD_ADMIN, User::ROLE_MASTER_ADMIN, User::ROLE_ADMIN], true);

        if ($isHeadAdminView) {
            // The head-admin view groups submissions into week buckets, so gather every
            // matching project first and paginate the week buckets afterwards.
            if ($showEmptyProjects) {
                $allProjects = $this->weeklyAccomplishmentRepository->listNonDesignProjects();

                $projectIds = $allProjects->pluck('id')->values()->all();
                $projects = $allProjects
                    ->map(fn ($project) => [
                        'id' => $project->id,
                        'name' => $project->name,
                    ])
                    ->values();
            } else {
                $projectIds = $this->weeklyAccomplishmentRepository->listWeeklyProjectIds($search, $filters);
            }
        } elseif ($showEmptyProjects) {
            $paginator = $this->weeklyAccomplishmentRepository->paginateNonDesignProjects($perPage);

            $projectIds = collect($paginator->items())
                ->map(fn ($item) => $item->id ?? null)
                ->values()
                ->unique()
                ->all();

            $projects = collect($paginator->items())
                ->map(fn ($project) => [
                    'id' => $project->id,
                    'name' => $project->name,
                ])
                ->values();
        } else {
            $paginator = $this->weeklyAccomplishmentRepository->paginateWeeklyProjectIds($search, $perPage, $filters);

            $projectIds = collect($paginator->items())
                ->map(fn ($item) => $item->project_id ?? null)
                ->values()
                ->unique()
                ->all();
        }

        $accomplishments = $this->weeklyAccomplishmentRepository
            ->listWeeklyAccomplishmentsByProjectIds($projectIds, $search, $filters);
        if (!$accomplishments instanceof Collection) {
            $accomplishments = collect($accomplishments);
        }

        $accomplishments = $accomplishments
            ->sortBy(function (WeeklyAccomplishment $row) use ($projectIds) {
                $targetKey = $row->project_id === null ? '__null__' : (string) $row->project_id;
                foreach ($projectIds as $index => $projectId) {
                    $currentKey = $projectId === null ? '__null__' : (string) $projectId;
                    if ($currentKey === $targetKey) {
                        return $index;
                    }
                }

                return PHP_INT_MAX;
            })
            ->values();

        $nonNullProjectIds = array_values(array_filter($projectIds, fn ($value) => $value !== null));
        $scopePhotos = $this->weeklyAccomplishmentRepository->listScopePhotosByProjectIds($nonNullProjectIds);

        $weeklyScopePhotoMap = [];
        foreach ($scopePhotos as $scopePhoto) {
            $scopeName = trim((string) ($scopePhoto->scope_name ?? ''));
            if ($scopeName === '') {
                continue;
            }

            $scopeKey = Str::lower($scopeName);
            if (!isset($weeklyScopePhotoMap[$scopeKey])) {
                $weeklyScopePhotoMap[$scopeKey] = [];
            }

            if (count($weeklyScopePhotoMap[$scopeKey]) >= 40) {
                continue;
            }

            $weeklyScopePhotoMap[$scopeKey][] = [
                'id' => (int) $scopePhoto->id,
                'project_id' => (int) ($scopePhoto->project_id ?? 0),
                'photo_path' => $scopePhoto->photo_path,
                'caption' => $scopePhoto->caption,
                'created_at' => optional($scopePhoto->created_at)?->toDateTimeString(),
                'week_start' => $this->extractWeekStartFromScopePhoto($scopePhoto->caption),
            ];
        }

        $accomplishments = $accomplishments
            ->map(function (WeeklyAccomplishment $row) {
                $submitter = $row->submitter;
                $submittedByName = $submitter?->fullname ?? $row->foreman?->fullname ?? 'Unknown';
                $submittedByRole = $submitter
                    ? ucwords(str_replace('_', ' ', (string) $submitter->role))
                    : 'Foreman';

                return [
                    'id' => $row->id,
                    'foreman_name' => $row->foreman?->fullname ?? 'Unknown',
                    'submitted_by_name' => $submittedByName,
                    'submitted_by_role' => $submittedByRole,
                    // Side rule input: PM side = foreman_id NULL (independent
                    // PM rows); historical PM rows stored under a foreman_id
                    // are frozen and ignored by both sides.
                    'foreman_id' => $row->foreman_id !== null ? (int) $row->foreman_id : null,
                    'project_id' => $row->project_id,
                    // Preserved through week-bucket regrouping (which rewrites
                    // project_id) so photos can be matched to their project.
                    'project_id_real' => $row->project_id !== null ? (int) $row->project_id : null,
                    'project_name' => $row->project?->name ?? 'Unassigned',
                'week_start' => $row->week_start
                    ? Carbon::parse($row->week_start)->toDateString()
                    : null,
                'scope_of_work' => $row->scope_of_work,
                'percent_completed' => $row->percent_completed,
                'is_placeholder' => (bool) $row->is_placeholder,
                'submitted_at' => optional($row->updated_at)?->toDateTimeString(),
                'created_at' => optional($row->created_at)?->toDateTimeString(),
                ];
            })
            ->values();

        // Keep the full set of rows (including unedited auto-seeded placeholders)
        // so the head-admin view can build the continuous weekly timeline down to
        // the current week, even for weeks that have no real submission yet.
        $timelineAccomplishments = $accomplishments;

        $accomplishments = $accomplishments
            ->filter(function (array $row) use ($weeklyScopePhotoMap): bool {
                $scopeKey = strtolower(trim((string) ($row['scope_of_work'] ?? '')));
                $rowWeek = trim((string) ($row['week_start'] ?? ''));

                if ($scopeKey === '' || $rowWeek === '') {
                    return false;
                }

                // Real submissions are always surfaced. Auto-seeded placeholder rows
                // (cloned templates) only appear once they were actually edited or a
                // scope photo was uploaded for that week.
                if (!(bool) ($row['is_placeholder'] ?? false)) {
                    return true;
                }

                $updatedAt = trim((string) ($row['submitted_at'] ?? ''));
                $createdAt = trim((string) ($row['created_at'] ?? ''));
                if ($updatedAt !== '' && $createdAt !== '' && $updatedAt !== $createdAt) {
                    return true;
                }

                foreach ($weeklyScopePhotoMap[$scopeKey] ?? [] as $photo) {
                    if (trim((string) ($photo['week_start'] ?? '')) === $rowWeek) {
                        return true;
                    }
                }

                return false;
            })
            ->values();

        if (!$isHeadAdminView) {
            // For the project-grouped admin view, insert a placeholder row for any week
            // between the project's first and last edited week that has no submission.
            $accomplishments = $this->fillEmptyAdminWeeks($accomplishments);
        }

        if ($isHeadAdminView) {
            // Group by submission (week) so progress can be reviewed week by week, then
            // paginate the week buckets server-side (5 weeks per page by default).
            [$weekProjects, $weekRows] = $this->buildWeekGroupedPayload(
                $timelineAccomplishments,
                $accomplishments,
                $projects,
                $this->shouldExtendTimelineToCurrentWeek($filters)
            );

            $totalWeeks = $weekProjects->count();
            $lastPage = max(1, (int) ceil($totalWeeks / $perPage));
            $page = min(max(1, (int) $request->query('page', 1)), $lastPage);
            $offset = ($page - 1) * $perPage;

            $weekProjects = $weekProjects->slice($offset, $perPage)->values();
            $pageKeys = $weekProjects->pluck('id')->map(fn ($id) => (string) $id)->all();
            $weekRows = $weekRows
                ->filter(fn ($row) => in_array((string) ($row['project_id'] ?? ''), $pageKeys, true))
                ->values();

            $projects = $weekProjects;
            $accomplishments = $weekRows;

            $paginator = new LengthAwarePaginator(
                $weekProjects->all(),
                $totalWeeks,
                $perPage,
                $page,
                ['path' => LengthAwarePaginator::resolveCurrentPath(), 'query' => $request->query()]
            );
        }

        $page = $isHeadAdminView
            ? 'HeadAdmin/WeeklyAccomplishments/Index'
            : 'Admin/WeeklyAccomplishments/Index';

        $comparison = $this->buildComparisonPayload($timelineAccomplishments, $nonNullProjectIds);

        return [
            'page' => $page,
            'props' => [
                'weeklyAccomplishments' => $accomplishments,
                'projects' => $projects,
                'weeklyAccomplishmentTable' => $this->tableMeta($paginator, $search, $status, $filters),
                'weeklyScopePhotoMap' => $weeklyScopePhotoMap,
                'statusFilters' => [],
                'selectedStatus' => $status,
                'filterProjects' => $this->weeklyAccomplishmentRepository->filterProjects()
                    ->map(fn ($project) => [
                        'id' => $project->id,
                        'name' => $project->name,
                    ])
                    ->values(),
                'filterSubmitters' => $this->weeklyAccomplishmentRepository->filterSubmitters()
                    ->map(fn ($user) => [
                        'id' => $user->id,
                        'fullname' => $user->fullname,
                        'role' => $user->role,
                    ])
                    ->values(),
                'groupEmptyMessage' => $isHeadAdminView
                    ? 'No accomplishments created this week.'
                    : 'No accomplishments for this project.',
                'comparisonRows' => $comparison['rows'],
                'overviewStats' => $comparison['stats'],
                'workInfoMap' => $comparison['workInfo'],
            ],
        ];
    }

    /**
     * Entire scope list per project for weighting: the project's scope plan
     * (or the standard scope plan when it has none yet), plus any scope
     * name that was actually submitted (manual scopes). Keyed by project id.
     *
     * @return array<int, string[]>
     */
    private function comparisonScopeUniverse(array $projectIds, Collection $grouped): array
    {
        $intIds = array_values(array_unique(array_map(
            static fn ($id) => (int) $id,
            array_filter($projectIds, fn ($id) => $id !== null && $id !== '')
        )));

        $repoMap = $intIds === []
            ? []
            : $this->weeklyAccomplishmentRepository->listScopeNamesByProjectIds($intIds);

        $map = [];
        foreach ($grouped as $projectId => $projectRows) {
            $planned = $repoMap[(int) $projectId] ?? [];
            $submitted = $projectRows
                ->map(fn (array $row) => trim((string) ($row['scope_of_work'] ?? '')))
                ->filter()
                ->unique(fn (string $scope) => strtolower($scope))
                ->values()
                ->all();
            $map[(int) $projectId] = array_values(array_unique(array_merge($planned, $submitted)));
        }

        return $map;
    }

    /**
     * Planned scope weights per project, keyed by project id then
     * lower-cased scope name. Same source/meaning as the /projects kanban
     * weighted overall progress (project_scopes.weight_percent).
     *
     * @return array<int, array<string, float>>
     */
    private function comparisonScopeWeights(array $projectIds): array
    {
        $intIds = array_values(array_unique(array_map(
            static fn ($id) => (int) $id,
            array_filter($projectIds, fn ($id) => $id !== null && $id !== '')
        )));

        if ($intIds === []) {
            return [];
        }

        $rows = ProjectScope::query()
            ->whereIn('project_id', $intIds)
            ->whereRaw("TRIM(COALESCE(scope_name, '')) != ?", [''])
            ->get(['project_id', 'scope_name', 'weight_percent']);

        $map = [];
        foreach ($rows as $row) {
            $scopeKey = strtolower(trim((string) $row->scope_name));
            if ($scopeKey === '') {
                continue;
            }
            $projectKey = (int) $row->project_id;
            $map[$projectKey][$scopeKey] = ($map[$projectKey][$scopeKey] ?? 0.0)
                + (float) ($row->weight_percent ?? 0);
        }

        return $map;
    }

    /**
     * Latest submission wins per side: for each (side, scope) pair keeps the
     * row with the highest id — PM rows never move Foreman values and vice
     * versa, so each column moves only when its own side submits. Real
     * submissions are preferred over auto-seeded placeholders.
     *
     * @return array{pm: array<string, array>, foreman: array<string, array>}
     */
    private function latestValuesBySide(Collection $rows): array
    {
        $sides = ['pm' => [], 'foreman' => []];

        foreach ($rows as $row) {
            $scope = trim((string) ($row['scope_of_work'] ?? ''));
            if ($scope === '' || trim((string) ($row['week_start'] ?? '')) === '') {
                continue;
            }

            // Frozen historical PM rows (foreman_id set, PM-submitted)
            // belong to neither side and are skipped.
            $side = self::rowSide(is_array($row) ? $row : []);
            if ($side === null) {
                continue;
            }
            $key = strtolower($scope);

            $existing = $sides[$side][$key] ?? null;
            if ($existing === null || (int) ($row['id'] ?? 0) > (int) ($existing['id'] ?? 0)) {
                $placeholder = (bool) ($row['is_placeholder'] ?? false);
                // A real submission always supersedes a placeholder, even an
                // older one; otherwise the higher id wins.
                if ($existing === null || ! ($existing['is_real'] ?? false) || ! $placeholder) {
                    $sides[$side][$key] = [
                        'id' => (int) ($row['id'] ?? 0),
                        'scope' => $scope,
                        'percent' => (float) ($row['percent_completed'] ?? 0),
                        'week_start' => (string) $row['week_start'],
                        'is_real' => ! $placeholder,
                    ];
                }
            }
        }

        return $sides;
    }

    private function buildComparisonPayload(Collection $timelineRows, array $projectIds): array
    {
        // Every visible project gets a row — including projects with no
        // submissions yet (no foreman assigned). Those render with missing
        // sides (— / Pending) instead of vanishing from the table.
        $allProjectIds = array_values(array_unique(array_map(
            static fn ($id) => (int) $id,
            array_filter($projectIds, fn ($id) => $id !== null && $id !== '')
        )));

        $projectMeta = collect();
        if (! empty($allProjectIds)) {
            $projectMeta = Project::query()
                ->whereIn('id', $allProjectIds)
                ->get(['id', 'name', 'location', 'target', 'overall_progress', 'phase', 'status'])
                ->keyBy(fn ($project) => (int) $project->id);
        }

        $isPmRow = static fn (array $row): bool => self::rowSide($row) === 'pm';
        $isForemanRow = static fn (array $row): bool => self::rowSide($row) === 'foreman';

        $grouped = $timelineRows
            ->filter(fn (array $row) => ($row['project_id'] ?? null) !== null
                && trim((string) ($row['week_start'] ?? '')) !== ''
                && ! ($row['empty_week'] ?? false))
            ->groupBy(fn (array $row) => (int) $row['project_id']);

        // Entire scope list per project (project scopes, defaulting to the
        // standard scope plan, plus any manually-submitted scope names) so a
        // newly-submitted low scope can never drag an average down: scopes
        // nobody submitted yet count as 0 instead of being excluded.
        $scopeUniverse = $this->comparisonScopeUniverse(
            $allProjectIds,
            $grouped
        );

        // Planned scope weights per project (same source as the /projects
        // kanban weighted overall progress).
        $scopeWeights = $this->comparisonScopeWeights($allProjectIds);

        // PM column comes from the shared PmProgressService (independent PM
        // rows only) so every page agrees on one PM number.
        $pmProgressByProject = $this->pmProgressService->progressByProjectIds($allProjectIds);

        $rows = [];
        foreach ($allProjectIds as $projectId) {
            $projectRows = $grouped->get($projectId, collect());
            // Foreman column weights the foreman side's own latest-per-scope
            // values by the planned scope weights (missing = 0), so a
            // submission moves only its own side's column. Variance is
            // computed ONLY over scopes both sides submitted — a scope one
            // side never touched can't skew it.
            $latest = $this->latestValuesBySide($projectRows);
            $foremanEntries = array_values($latest['foreman']);

            $universe = $scopeUniverse[(int) $projectId] ?? [];

            // Weighted progress ONLY, same computation as the /projects
            // kanban (SUM of ROUND(weight × progress / 100, 2) per scope).
            // Weights come from the project's scope plan; scopes nobody
            // submitted yet count as 0, and submitted scopes with no planned
            // weight contribute 0 — so a project whose plan has no weights
            // reads 0, exactly like /projects does.
            $weights = $scopeWeights[(int) $projectId] ?? [];
            $foremanWeighted = 0.0;
            foreach ($universe as $scopeName) {
                $scopeKey = strtolower(trim((string) $scopeName));
                $weight = (float) ($weights[$scopeKey] ?? 0);
                if ($weight == 0.0) {
                    continue;
                }
                $foremanWeighted += round($weight * (float) ($latest['foreman'][$scopeKey]['percent'] ?? 0) / 100, 2);
            }

            $pmProgress = $pmProgressByProject[(int) $projectId] ?? null;
            $foremanProgress = $foremanEntries !== [] ? round($foremanWeighted, 2) : null;

            $commonKeys = array_values(array_intersect(array_keys($latest['pm']), array_keys($latest['foreman'])));

            // Variance is the gap between the two displayed progress columns
            // (|PM progress − Foreman progress|), so the number and the
            // status always agree with what the row shows. A missing side
            // leaves variance missing too — so the row shows "—" / Pending
            // instead of a fake gap.
            $variance = ($pmProgress !== null && $foremanProgress !== null)
                ? round(abs($pmProgress - $foremanProgress), 2)
                : null;
            $status = $variance === null
                ? 'Pending'
                : ($variance <= 5 ? 'On Track' : ($variance <= 10 ? 'Needs Review' : 'Investigate'));

            $latestWeek = collect($commonKeys)
                ->flatMap(fn (string $key) => [$latest['pm'][$key]['week_start'], $latest['foreman'][$key]['week_start']])
                ->map(fn ($week) => (string) $week)->filter()->max()
                ?: $projectRows->map(fn (array $row) => (string) $row['week_start'])->filter()->max();

            $lastPm = $projectRows->filter(fn (array $row) => $isPmRow($row))
                ->map(fn (array $row) => (string) ($row['submitted_at'] ?? ''))->filter()->max();
            $lastForeman = $projectRows->filter(fn (array $row) => $isForemanRow($row))
                ->map(fn (array $row) => (string) ($row['submitted_at'] ?? ''))->filter()->max();

            $meta = $projectMeta->get((int) $projectId);
            $rows[] = [
                'project_id' => (int) $projectId,
                'project_name' => $meta?->name ?? (string) ($projectRows->first()['project_name'] ?? 'Unassigned'),
                'location' => $meta?->location ? (string) $meta->location : null,
                'target' => $meta?->target ? Carbon::parse($meta->target)->toDateString() : null,
                'overall_progress' => $meta?->overall_progress !== null ? (int) $meta->overall_progress : null,
                'pm_progress' => $pmProgress,
                'foreman_progress' => $foremanProgress,
                'variance' => $variance,
                'status' => $status,
                'week_start' => $latestWeek,
                'last_pm_submission' => $lastPm ?: null,
                'last_foreman_submission' => $lastForeman ?: null,
            ];
        }

        usort($rows, fn (array $a, array $b) => strcmp((string) $a['project_name'], (string) $b['project_name']));

        $total = count($rows);
        $onTrack = count(array_filter($rows, fn (array $row) => $row['status'] === 'On Track'));
        $needsReview = count(array_filter($rows, fn (array $row) => $row['status'] === 'Needs Review'));
        $withDiscrepancy = count(array_filter($rows, fn (array $row) => $row['status'] === 'Investigate'));
        $pending = count(array_filter($rows, fn (array $row) => $row['status'] === 'Pending'));

        return [
            'rows' => array_values($rows),
            'stats' => [
                'total_projects' => $total,
                'on_track' => $onTrack,
                'needs_review' => $needsReview,
                'with_discrepancy' => $withDiscrepancy,
                'pending' => $pending,
                'on_track_percent' => $total > 0 ? round($onTrack / $total * 100) : 0,
                'needs_review_percent' => $total > 0 ? round($needsReview / $total * 100) : 0,
                'with_discrepancy_percent' => $total > 0 ? round($withDiscrepancy / $total * 100) : 0,
                'pending_percent' => $total > 0 ? round($pending / $total * 100) : 0,
            ],
            'workInfo' => $this->buildWorkInfoMap($projectIds),
        ];
    }

    /**
     * Derive Work Information from existing tables (no migration):
     * manpower from attendances, equipment/materials from deliveries +
     * material requests, remarks from the latest issue report.
     */
    private function buildWorkInfoMap(array $projectIds): array
    {
        $ids = array_values(array_filter($projectIds, fn ($value) => $value !== null));
        if ($ids === []) {
            return [];
        }

        $attendances = Attendance::query()
            ->whereIn('project_id', $ids)
            ->whereNotNull('date')
            ->get(['project_id', 'worker_name', 'date']);
        $deliveries = DeliveryConfirmation::query()
            ->whereIn('project_id', $ids)
            ->get(['project_id', 'item_delivered', 'quantity', 'supplier', 'created_at']);
        $materials = MaterialRequest::query()
            ->whereIn('project_id', $ids)
            ->get(['project_id', 'material_name', 'quantity', 'unit', 'created_at']);
        $issues = IssueReport::query()
            ->whereIn('project_id', $ids)
            ->orderByDesc('created_at')
            ->get(['project_id', 'description', 'issue_title', 'created_at']);

        $weekKey = static function ($projectId, ?string $date): ?string {
            if (! $date) {
                return null;
            }
            try {
                $week = Carbon::parse(substr($date, 0, 10))->startOfWeek(Carbon::MONDAY)->toDateString();
            } catch (\Throwable) {
                return null;
            }

            return (int) $projectId . '|' . $week;
        };

        $map = [];
        $ensure = function (string $key, $projectId) use (&$map) {
            if (! isset($map[$key])) {
                $map[$key] = [
                    'project_id' => (int) $projectId,
                    'manpower' => 0,
                    'worker_names' => [],
                    'equipment' => [],
                    'materials' => [],
                    'remarks' => null,
                ];
            }
        };

        foreach ($attendances as $attendance) {
            $key = $weekKey($attendance->project_id, (string) ($attendance->date ?? ''));
            if (! $key) {
                continue;
            }
            $ensure($key, $attendance->project_id);
            $name = trim((string) ($attendance->worker_name ?? ''));
            if ($name !== '' && ! in_array($name, $map[$key]['worker_names'], true)) {
                $map[$key]['worker_names'][] = $name;
            }
        }

        foreach ($deliveries as $delivery) {
            $key = $weekKey($delivery->project_id, (string) ($delivery->created_at ?? ''));
            if (! $key) {
                continue;
            }
            $ensure($key, $delivery->project_id);
            $label = trim((string) ($delivery->item_delivered ?? ''));
            if ($label !== '') {
                $quantity = trim((string) ($delivery->quantity ?? ''));
                $map[$key]['materials'][] = $quantity !== '' ? $label . ' - ' . $quantity : $label;
            }
        }

        foreach ($materials as $material) {
            $key = $weekKey($material->project_id, (string) ($material->created_at ?? ''));
            if (! $key) {
                continue;
            }
            $ensure($key, $material->project_id);
            $label = trim((string) ($material->material_name ?? ''));
            if ($label !== '') {
                $quantity = trim((string) ($material->quantity ?? ''));
                $unit = trim((string) ($material->unit ?? ''));
                $suffix = trim($quantity . ' ' . $unit);
                $map[$key]['materials'][] = $suffix !== '' ? $label . ' - ' . $suffix : $label;
            }
        }

        foreach ($issues as $issue) {
            $key = $weekKey($issue->project_id, (string) ($issue->created_at ?? ''));
            if (! $key) {
                continue;
            }
            $ensure($key, $issue->project_id);
            if ($map[$key]['remarks'] === null) {
                $map[$key]['remarks'] = trim((string) ($issue->description ?? $issue->issue_title ?? ''));
            }
        }

        return collect($map)->map(function (array $entry) {
            $entry['manpower'] = count($entry['worker_names']);
            $entry['equipment'] = array_values(array_unique(array_filter(array_map(
                static fn ($item) => trim((string) $item),
                $entry['materials']
            ))));
            $entry['materials_used'] = implode(', ', array_slice($entry['equipment'], 0, 6));
            unset($entry['worker_names']);

            return $entry;
        })->all();
    }

    /**
     * Detail payload for the standalone Project Detail page
     * (GET /weekly-accomplishments/{project}). Additive only — the index
     * payload and every other page are untouched.
     *
     * The submissions table carries page 1 (50/side) plus totals; older
     * pages load through detailSubmissions(). The photo map stays complete
     * because the sidebar detail and preview resolve per-scope photos
     * from it.
     */
    public function detailPayload(Request $request, Project $project): array
    {
        $this->weeklyAccomplishmentRepository->generateSkippedWeeksToCurrent();

        [$timelineRows, $weeklyScopePhotoMap, $rows, $photoTotal] = $this->detailRowsData($project);

        $comparison = $this->buildComparisonPayload($timelineRows, [$project->id]);

        // The Overview donut must always equal the PM progress shown on
        // /projects (strictly PM-based): the comparison's own pm_progress,
        // or 0 when the PM side has no independent data yet.
        $comparisonRow = $comparison['rows'][0] ?? null;
        if (is_array($comparisonRow)) {
            $comparisonRow['overall_progress'] = $comparisonRow['pm_progress'] ?? 0.0;
            $comparison['rows'][0] = $comparisonRow;
        }

        $latest = $this->latestValuesBySide($rows);
        $scopeKeys = array_unique(array_merge(array_keys($latest['pm']), array_keys($latest['foreman'])));

        $scopeBreakdown = array_map(function (string $key) use ($latest) {
            $pmEntry = $latest['pm'][$key] ?? null;
            $foremanEntry = $latest['foreman'][$key] ?? null;
            $pm = $pmEntry !== null ? (float) $pmEntry['percent'] : null;
            $foreman = $foremanEntry !== null ? (float) $foremanEntry['percent'] : null;
            $variance = ($pm !== null && $foreman !== null) ? round(abs($pm - $foreman), 2) : null;

            return [
                'scope' => (string) ($pmEntry['scope'] ?? $foremanEntry['scope'] ?? $key),
                'pm' => $pm,
                'foreman' => $foreman,
                'variance' => $variance,
                'status' => $variance === null
                    ? 'Pending'
                    : ($variance <= 5 ? 'On Track' : ($variance <= 10 ? 'Needs Review' : 'Investigate')),
            ];
        }, $scopeKeys);

        usort($scopeBreakdown, fn (array $a, array $b) => strcmp($a['scope'], $b['scope']));

        // Listing-only split. The foreman list drops rows uploaded on a
        // foreman's behalf (Head Admin / Admin / HR jotform imports): those
        // still drive foreman progress, but they are not foreman submissions.
        $pmRows = $rows->filter(fn (array $row) => self::isPmDetailRow($row))->values();
        $foremanRows = $rows->filter(fn (array $row) => self::isForemanSubmissionRow($row))->values();

        $isHeadAdminView = in_array($request->user()->role, [User::ROLE_HEAD_ADMIN, User::ROLE_MASTER_ADMIN, User::ROLE_ADMIN], true);

        return [
            'page' => $isHeadAdminView
                ? 'HeadAdmin/WeeklyAccomplishments/Show'
                : 'Admin/WeeklyAccomplishments/Show',
            'props' => [
                'project' => [
                    'id' => (int) $project->id,
                    'name' => (string) $project->name,
                    'location' => $project->location ? (string) $project->location : null,
                    'target' => $project->target ? Carbon::parse($project->target)->toDateString() : null,
                    'overall_progress' => $project->overall_progress !== null ? (int) $project->overall_progress : null,
                    'phase' => (string) ($project->phase ?? ''),
                    'status' => (string) ($project->status ?? ''),
                ],
                'comparison' => $comparison['rows'][0] ?? null,
                'scopeBreakdown' => $scopeBreakdown,
                'recentPmSubmission' => $pmRows->sortByDesc(fn (array $row) => (string) ($row['submitted_at'] ?? ''))->first(),
                'recentForemanSubmission' => $foremanRows->sortByDesc(fn (array $row) => (string) ($row['submitted_at'] ?? ''))->first(),
                'rows' => $pmRows->take(self::DETAIL_SUBMISSIONS_PER_PAGE)
                    ->merge($foremanRows->take(self::DETAIL_SUBMISSIONS_PER_PAGE))
                    ->values(),
                'submissionTotals' => [
                    'pm' => $pmRows->count(),
                    'foreman' => $foremanRows->count(),
                ],
                'photoTotal' => $photoTotal,
                'weeklyScopePhotoMap' => $weeklyScopePhotoMap,
                'workInfoMap' => $comparison['workInfo'],
            ],
        ];
    }

    /**
     * Server-paginated submissions for one side of the detail page
     * (GET /weekly-accomplishments/{project}/submissions?side=pm|foreman&page=N).
     */
    public function detailSubmissions(Request $request, Project $project): array
    {
        $this->ensureAuthorized($request->user());

        $side = strtolower(trim((string) $request->query('side', 'foreman')));
        if (! in_array($side, ['pm', 'foreman'], true)) {
            $side = 'foreman';
        }
        $page = max(1, (int) $request->query('page', 1));

        [, , $rows] = $this->detailRowsData($project);
        $filtered = $rows->filter(fn (array $row) => $side === 'pm'
            ? self::isPmDetailRow($row)
            : self::isForemanSubmissionRow($row))->values();

        $total = $filtered->count();
        $data = $filtered->forPage($page, self::DETAIL_SUBMISSIONS_PER_PAGE)->values();

        return [
            'data' => $data->all(),
            'current_page' => $page,
            'per_page' => self::DETAIL_SUBMISSIONS_PER_PAGE,
            'total' => $total,
            'last_page' => (int) max(1, ceil($total / self::DETAIL_SUBMISSIONS_PER_PAGE)),
        ];
    }

    /**
     * Server-paginated flat progress photos for the detail page
     * (GET /weekly-accomplishments/{project}/photos?page=N).
     */
    public function detailPhotos(Request $request, Project $project): array
    {
        $this->ensureAuthorized($request->user());

        $page = max(1, (int) $request->query('page', 1));

        $baseQuery = ScopePhoto::query()
            ->select([
                'scope_photos.id',
                'scope_photos.photo_path',
                'scope_photos.caption',
                'scope_photos.created_at',
                'project_scopes.project_id',
                'project_scopes.scope_name',
            ])
            ->join('project_scopes', 'project_scopes.id', '=', 'scope_photos.project_scope_id')
            ->where('project_scopes.project_id', $project->id)
            ->orderByDesc('scope_photos.id');

        $total = (clone $baseQuery)->count();
        $photos = $baseQuery
            ->forPage($page, self::DETAIL_PHOTOS_PER_PAGE)
            ->get()
            ->map(fn ($photo) => [
                'id' => (int) $photo->id,
                'project_id' => (int) ($photo->project_id ?? $project->id),
                'photo_path' => $photo->photo_path,
                'caption' => $photo->caption,
                'created_at' => optional($photo->created_at)?->toDateTimeString(),
                'week_start' => $this->extractWeekStartFromScopePhoto($photo->caption),
                'scope_name' => trim((string) ($photo->scope_name ?? '')),
            ])
            ->values();

        return [
            'data' => $photos->all(),
            'current_page' => $page,
            'per_page' => self::DETAIL_PHOTOS_PER_PAGE,
            'total' => $total,
            'last_page' => (int) max(1, ceil($total / self::DETAIL_PHOTOS_PER_PAGE)),
        ];
    }

    /**
     * Shared rows pipeline for the detail page: mapped timeline rows, the
     * per-scope photo map, the filtered display rows, and the uncapped
     * photo total.
     *
     * @return array{0: \Illuminate\Support\Collection, 1: array, 2: \Illuminate\Support\Collection, 3: int}
     */
    private function detailRowsData(Project $project): array
    {
        $timelineRows = WeeklyAccomplishment::query()
            ->with('foreman:id,fullname', 'submitter:id,fullname,role', 'project:id,name')
            ->where('project_id', $project->id)
            ->latest('updated_at')
            ->get()
            ->map(fn (WeeklyAccomplishment $row) => $this->mapDetailRow($row))
            ->values();

        $scopePhotos = ScopePhoto::query()
            ->select([
                'scope_photos.id',
                'scope_photos.photo_path',
                'scope_photos.caption',
                'scope_photos.created_at',
                'project_scopes.project_id',
                'project_scopes.scope_name',
            ])
            ->join('project_scopes', 'project_scopes.id', '=', 'scope_photos.project_scope_id')
            ->where('project_scopes.project_id', $project->id)
            ->orderByDesc('scope_photos.id')
            ->get();

        $weeklyScopePhotoMap = [];
        foreach ($scopePhotos as $scopePhoto) {
            $scopeName = trim((string) ($scopePhoto->scope_name ?? ''));
            if ($scopeName === '') {
                continue;
            }

            $scopeKey = Str::lower($scopeName);
            if (! isset($weeklyScopePhotoMap[$scopeKey])) {
                $weeklyScopePhotoMap[$scopeKey] = [];
            }

            if (count($weeklyScopePhotoMap[$scopeKey]) >= 40) {
                continue;
            }

            $weeklyScopePhotoMap[$scopeKey][] = [
                'id' => (int) $scopePhoto->id,
                'project_id' => (int) ($scopePhoto->project_id ?? $project->id),
                'photo_path' => $scopePhoto->photo_path,
                'caption' => $scopePhoto->caption,
                'created_at' => optional($scopePhoto->created_at)?->toDateTimeString(),
                'week_start' => $this->extractWeekStartFromScopePhoto($scopePhoto->caption),
            ];
        }

        $rows = $timelineRows
            ->filter(function (array $row) use ($weeklyScopePhotoMap): bool {
                $scopeKey = strtolower(trim((string) ($row['scope_of_work'] ?? '')));
                $rowWeek = trim((string) ($row['week_start'] ?? ''));

                if ($scopeKey === '' || $rowWeek === '') {
                    return false;
                }

                if (! (bool) ($row['is_placeholder'] ?? false)) {
                    return true;
                }

                $updatedAt = trim((string) ($row['submitted_at'] ?? ''));
                $createdAt = trim((string) ($row['created_at'] ?? ''));
                if ($updatedAt !== '' && $createdAt !== '' && $updatedAt !== $createdAt) {
                    return true;
                }

                foreach ($weeklyScopePhotoMap[$scopeKey] ?? [] as $photo) {
                    if (trim((string) ($photo['week_start'] ?? '')) === $rowWeek) {
                        return true;
                    }
                }

                return false;
            })
            ->values();

        $photoTotal = ScopePhoto::query()
            ->join('project_scopes', 'project_scopes.id', '=', 'scope_photos.project_scope_id')
            ->where('project_scopes.project_id', $project->id)
            ->count();

        return [$timelineRows, $weeklyScopePhotoMap, $rows, $photoTotal];
    }

    /**
     * Data-source side of a mapped accomplishment row.
     *
     * - 'pm': independent PM rows (foreman_id NULL).
     * - 'foreman': Foreman JotForm rows (foreman_id set, not PM-submitted).
     * - null: frozen historical PM rows stored under a foreman_id — they
     *   belong to neither side and are ignored everywhere.
     */
    public static function rowSide(array $row): ?string
    {
        if (!array_key_exists('foreman_id', $row)) {
            return 'foreman';
        }

        if ($row['foreman_id'] === null || $row['foreman_id'] === '') {
            return 'pm';
        }

        $role = strtolower(trim((string) ($row['submitted_by_role'] ?? '')));
        if ($role === 'project manager' || $role === 'project_manager') {
            return null;
        }

        return 'foreman';
    }

    private static function isPmDetailRow(array $row): bool
    {
        return self::rowSide($row) === 'pm';
    }

    private static function isForemanDetailRow(array $row): bool
    {
        return self::rowSide($row) === 'foreman';
    }

    /**
     * Listing rule for the Foreman Submissions tab: the row must sit on the
     * foreman side AND have been submitted by a foreman. Rows uploaded on a
     * foreman's behalf by a Head Admin / Admin / HR (the processed-record
     * import flow stores the uploader in submitted_by) are excluded from the
     * list while still counting toward foreman progress. A row with no
     * recorded submitter keeps the historical 'Foreman' fallback.
     */
    private static function isForemanSubmissionRow(array $row): bool
    {
        if (! self::isForemanDetailRow($row)) {
            return false;
        }

        $role = strtolower(trim((string) ($row['submitted_by_role'] ?? '')));

        return $role === '' || $role === 'foreman';
    }

    private function mapDetailRow(WeeklyAccomplishment $row): array
    {
        $submitter = $row->submitter;

        return [
            'id' => $row->id,
            'foreman_name' => $row->foreman?->fullname ?? 'Unknown',
            'submitted_by_name' => $submitter?->fullname ?? $row->foreman?->fullname ?? 'Unknown',
            'submitted_by_role' => $submitter
                ? ucwords(str_replace('_', ' ', (string) $submitter->role))
                : 'Foreman',
            'foreman_id' => $row->foreman_id !== null ? (int) $row->foreman_id : null,
            'project_id' => $row->project_id,
            'project_name' => $row->project?->name ?? 'Unassigned',
            'week_start' => $row->week_start
                ? Carbon::parse($row->week_start)->toDateString()
                : null,
            'scope_of_work' => $row->scope_of_work,
            'percent_completed' => $row->percent_completed,
            'is_placeholder' => (bool) $row->is_placeholder,
            'submitted_at' => optional($row->updated_at)?->toDateTimeString(),
            'created_at' => optional($row->created_at)?->toDateTimeString(),
        ];
    }

    /**
     * For each project found in the edited rows, expands the span between its first and
     * last edited week into a list of every 7-day week in between.
     *
     * @return array<string, string[]> keyed by project key (p{id} or p0 for unassigned)
     */
    private function weekRangesByProject(Collection $rows): array
    {
        $ranges = [];
        foreach ($rows as $row) {
            $projectId = $row['project_id'] ?? null;
            $projectKey = $projectId === null || $projectId === '' ? 'p0' : 'p' . (int) $projectId;
            $week = trim((string) ($row['week_start'] ?? ''));
            if ($week === '') {
                continue;
            }

            if (!isset($ranges[$projectKey])) {
                $ranges[$projectKey] = ['min' => $week, 'max' => $week];
                continue;
            }

            if ($week < $ranges[$projectKey]['min']) {
                $ranges[$projectKey]['min'] = $week;
            }
            if ($week > $ranges[$projectKey]['max']) {
                $ranges[$projectKey]['max'] = $week;
            }
        }

        $weeksByProject = [];
        foreach ($ranges as $projectKey => $range) {
            $cursor = Carbon::parse($range['min']);
            $end = Carbon::parse($range['max']);
            while (!$cursor->gt($end)) {
                $weeksByProject[$projectKey][] = $cursor->toDateString();
                $cursor->addDay(7);
            }
        }

        return $weeksByProject;
    }

    /**
     * Inserts placeholder rows for weeks that fall between a project's first and last
     * edited week but have no submission, so the admin view shows the whole timeline.
     */
    private function fillEmptyAdminWeeks(Collection $rows): Collection
    {
        $ranges = $this->weekRangesByProject($rows);
        if ($ranges === []) {
            return $rows;
        }

        $projectGroups = $rows->groupBy(fn (array $row) => $row['project_id'] === null || $row['project_id'] === ''
            ? 'p0'
            : 'p' . (int) $row['project_id']);

        $result = collect();
        foreach ($projectGroups as $projectKey => $projectGroup) {
            $weeks = $ranges[$projectKey] ?? [];
            $existingWeeks = $projectGroup->pluck('week_start')->map(fn ($week) => trim((string) $week))->flip();

            foreach ($weeks as $weekStart) {
                if ($existingWeeks->has($weekStart)) {
                    continue;
                }

                $sample = $projectGroup->first();
                $projectGroup->push([
                    'id' => 'empty-week-' . $projectKey . '-' . $weekStart,
                    'foreman_name' => null,
                    'project_id' => $sample['project_id'] ?? null,
                    'project_name' => $sample['project_name'] ?? 'Unassigned',
                    'week_start' => $weekStart,
                    'scope_of_work' => null,
                    'percent_completed' => null,
                    'submitted_at' => null,
                    'created_at' => null,
                    'empty_week' => true,
                ]);
            }

            $result = $result->merge($projectGroup->sortByDesc('week_start'));
        }

        return $result->values();
    }

    private function shouldExtendTimelineToCurrentWeek(array $filters): bool
    {
        // Only extend the timeline forward to the current week when the user has
        // not bounded the view with a week or submission-date filter. Filtered
        // views should stick to exactly the range they asked for.
        return trim((string) ($filters['week_from'] ?? '')) === ''
            && trim((string) ($filters['week_to'] ?? '')) === ''
            && trim((string) ($filters['date_from'] ?? '')) === ''
            && trim((string) ($filters['date_to'] ?? '')) === '';
    }

    private function tableMeta($paginator, string $search, string $status = '', array $filters = []): array
    {
        return [
            'search' => $search,
            'per_page' => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page' => max(1, $paginator->lastPage()),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
            'status' => $status,
            'project_id' => $filters['project_id'] ?? '',
            'submitted_by' => $filters['submitted_by'] ?? '',
            'week_from' => $filters['week_from'] ?? '',
            'week_to' => $filters['week_to'] ?? '',
            'date_from' => $filters['date_from'] ?? '',
            'date_to' => $filters['date_to'] ?? '',
        ];
    }

    private function extractWeekStartFromScopePhoto(?string $caption): ?string
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
     * Re-group weekly accomplishments into per-submission (week) buckets.
     * Each bucket becomes an accordion group titled "Week of ... — Project".
     *
     * The week timeline is derived from $timelineRows (the full row set, which
     * includes auto-seeded placeholders) and extended forward to the current
     * week, so weeks after a project's last real submission still appear as
     * empty tabs. Only $rows (edited/real submissions) are rendered as content.
     */
    private function buildWeekGroupedPayload(
        Collection $timelineRows,
        Collection $rows,
        Collection $projects,
        bool $extendToCurrentWeek
    ): array {
        $projectNames = collect($projects)->mapWithKeys(fn ($project) => [
            (int) ($project['id'] ?? 0) => (string) ($project['name'] ?? ''),
        ]);

        $rowsByWeek = [];
        foreach ($rows as $row) {
            $projectId = $row['project_id'];
            $weekStart = (string) ($row['week_start'] ?? '');
            $weekKey = $projectId !== null && $projectId !== ''
                ? "w{$projectId}-{$weekStart}"
                : "w-0-{$weekStart}";

            if (!isset($rowsByWeek[$weekKey])) {
                $rowsByWeek[$weekKey] = [];
            }

            $rowsByWeek[$weekKey][] = $row;
        }

        $rowProjectNames = collect($timelineRows)->mapWithKeys(fn (array $row) => [
            $row['project_id'] === null || $row['project_id'] === ''
                ? 'p0'
                : 'p' . (int) $row['project_id'] => (string) ($row['project_name'] ?? 'Unassigned'),
        ]);

        $currentWeek = Carbon::now('Asia/Manila')
            ->startOfWeek(Carbon::MONDAY)
            ->toDateString();

        $groups = [];
        foreach ($this->weekRangesByProject($timelineRows) as $projectKey => $weeks) {
            $projectId = $projectKey === 'p0' ? null : (int) substr($projectKey, 1);
            $projectName = $rowProjectNames->get(
                $projectKey,
                $projectNames->get((int) $projectId, 'Unassigned')
            );

            $end = Carbon::parse($weeks[count($weeks) - 1]);
            if ($extendToCurrentWeek && $end->lt(Carbon::parse($currentWeek))) {
                $end = Carbon::parse($currentWeek);
            }
            $cursor = Carbon::parse($weeks[0]);

            while (!$cursor->gt($end)) {
                $weekStart = $cursor->toDateString();
                $weekKey = $projectKey === 'p0' ? "w-0-{$weekStart}" : "w{$projectId}-{$weekStart}";

                if (!isset($groups[$weekKey])) {
                    $groups[$weekKey] = [
                        'key' => $weekKey,
                        'project_id' => $projectId,
                        'project_name' => $projectName,
                        'week_start' => $weekStart,
                        'rows' => $rowsByWeek[$weekKey] ?? [],
                    ];
                }

                $cursor->addDay(7);
            }
        }

        $orderedGroups = collect($groups)
            ->sortByDesc(fn (array $group) => $group['week_start'])
            ->values();

        $weekProjects = $orderedGroups->map(fn (array $group) => [
            'id' => $group['key'],
            'name' => $group['week_start'] !== ''
                ? 'Week of ' . Carbon::parse($group['week_start'])->format('M j, Y') . ' - ' . Carbon::parse($group['week_start'])->addDays(6)->format('M j, Y') . ' — ' . $group['project_name']
                : $group['project_name'],
        ])->values();

        $weekRows = $orderedGroups->flatMap(function (array $group) {
            return collect($group['rows'])->map(function (array $row) use ($group) {
                $row['project_id'] = $group['key'];

                return $row;
            });
        })->values();

        return [$weekProjects, $weekRows];
    }
}
