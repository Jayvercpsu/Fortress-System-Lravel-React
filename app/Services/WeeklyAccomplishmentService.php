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
                'submitted_at' => optional($row->updated_at)?->toDateTimeString(),
                'created_at' => optional($row->created_at)?->toDateTimeString(),
            ])
            ->values();

        if ($isHeadAdminView) {
            // Group by submission (week) so progress can be reviewed week by week, then
            // paginate the week buckets server-side (5 weeks per page by default).
            [$weekProjects, $weekRows] = $this->buildWeekGroupedPayload($accomplishments, $projects);

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
            ],
        ];
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
     */
    private function buildWeekGroupedPayload(Collection $rows, Collection $projects): array
    {
        $projectNames = collect($projects)->mapWithKeys(fn ($project) => [
            (int) ($project['id'] ?? 0) => (string) ($project['name'] ?? ''),
        ]);

        $groups = [];
        foreach ($rows as $row) {
            $projectId = $row['project_id'];
            $weekStart = (string) ($row['week_start'] ?? '');
            $weekKey = $projectId !== null && $projectId !== ''
                ? "w{$projectId}-{$weekStart}"
                : "w-0-{$weekStart}";

            if (!isset($groups[$weekKey])) {
                $groups[$weekKey] = [
                    'key' => $weekKey,
                    'project_id' => $projectId,
                    'project_name' => (string) ($row['project_name'] ?? $projectNames->get((int) $projectId, 'Unassigned')),
                    'week_start' => $weekStart,
                    'rows' => [],
                ];
            }

            $groups[$weekKey]['rows'][] = $row;
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
