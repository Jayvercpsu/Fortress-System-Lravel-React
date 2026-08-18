<?php

namespace App\Services;

use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\WeeklyAccomplishmentRepositoryInterface;
use Illuminate\Http\Request;
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
        $perPage = (int) $request->query('per_page', 10);
        $status = trim((string) $request->query('status', ''));

        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
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
        $showEmptyProjects = $search === '' && $status === '' && !$hasActiveFilters;

        if ($showEmptyProjects) {
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

            if (count($weeklyScopePhotoMap[$scopeKey]) >= 8) {
                continue;
            }

            $weeklyScopePhotoMap[$scopeKey][] = [
                'id' => (int) $scopePhoto->id,
                'photo_path' => $scopePhoto->photo_path,
                'caption' => $scopePhoto->caption,
                'created_at' => optional($scopePhoto->created_at)?->toDateTimeString(),
            ];
        }

        $accomplishments = $accomplishments
            ->map(fn (WeeklyAccomplishment $row) => [
                'id' => $row->id,
                'foreman_name' => $row->foreman?->fullname ?? 'Unknown',
                'project_id' => $row->project_id,
                'project_name' => $row->project?->name ?? 'Unassigned',
                'week_start' => $row->week_start ? (string) $row->week_start : null,
                'scope_of_work' => $row->scope_of_work,
                'percent_completed' => $row->percent_completed,
                'submitted_at' => optional($row->updated_at)?->toDateTimeString(),
                'created_at' => optional($row->created_at)?->toDateTimeString(),
            ])
            ->values();

        $isHeadAdminView = in_array($request->user()->role, [User::ROLE_HEAD_ADMIN, User::ROLE_MASTER_ADMIN], true);
        if ($isHeadAdminView) {
            // Group by submission (week) so progress can be reviewed week by week.
            [$projects, $accomplishments] = $this->buildWeekGroupedPayload($accomplishments, $projects);
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
