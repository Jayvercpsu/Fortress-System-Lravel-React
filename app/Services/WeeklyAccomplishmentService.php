<?php

namespace App\Services;

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

    public function __construct(
        private readonly WeeklyAccomplishmentRepositoryInterface $weeklyAccomplishmentRepository
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
        $perPage = (int) $request->query('per_page', 5);
        $status = trim((string) $request->query('status', ''));

        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 5;
        }

        $filters = [
            'project_id' => trim((string) $request->query('project_id', '')),
            'foreman_id' => trim((string) $request->query('foreman_id', '')),
            'week_from' => trim((string) $request->query('week_from', '')),
            'week_to' => trim((string) $request->query('week_to', '')),
            'date_from' => trim((string) $request->query('date_from', '')),
            'date_to' => trim((string) $request->query('date_to', '')),
        ];

        $hasActiveFilters = collect($filters)->contains(fn ($value) => $value !== '');

        $projects = collect();
        $paginator = null;
        $showEmptyProjects = $search === '' && $status === '' && !$hasActiveFilters;

        $isHeadAdminView = in_array($request->user()->role, [User::ROLE_HEAD_ADMIN, User::ROLE_MASTER_ADMIN], true);

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
                'photo_path' => $scopePhoto->photo_path,
                'caption' => $scopePhoto->caption,
                'created_at' => optional($scopePhoto->created_at)?->toDateTimeString(),
                'week_start' => $this->extractWeekStartFromScopePhoto($scopePhoto->caption),
            ];
        }

        $accomplishments = $accomplishments
            ->map(fn (WeeklyAccomplishment $row) => [
                'id' => $row->id,
                'foreman_name' => $row->foreman?->fullname ?? 'Unknown',
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
            ])
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
                'filterForemen' => $this->weeklyAccomplishmentRepository->filterForemen()
                    ->map(fn ($foreman) => [
                        'id' => $foreman->id,
                        'fullname' => $foreman->fullname,
                    ])
                    ->values(),
                'groupEmptyMessage' => $isHeadAdminView
                    ? 'No accomplishments created this week.'
                    : 'No accomplishments for this project.',
            ],
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
            'foreman_id' => $filters['foreman_id'] ?? '',
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
