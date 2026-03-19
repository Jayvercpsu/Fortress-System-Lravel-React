<?php

namespace App\Services;

use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\WeeklyAccomplishmentRepositoryInterface;
use Illuminate\Http\Request;
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

        $projects = collect();
        $showEmptyProjects = $search === '' && $status === '';

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
            $paginator = $this->weeklyAccomplishmentRepository->paginateWeeklyProjectIds($search, $perPage);

            $projectIds = collect($paginator->items())
                ->map(fn ($item) => $item->project_id ?? null)
                ->values()
                ->unique()
                ->all();
        }

        $accomplishments = $this->weeklyAccomplishmentRepository
            ->listWeeklyAccomplishmentsByProjectIds($projectIds, $search);
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
                'created_at' => optional($row->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/WeeklyAccomplishments/Index'
            : 'Admin/WeeklyAccomplishments/Index';

        return [
            'page' => $page,
            'props' => [
                'weeklyAccomplishments' => $accomplishments,
                'projects' => $projects,
                'weeklyAccomplishmentTable' => $this->tableMeta($paginator, $search, $status),
                'weeklyScopePhotoMap' => $weeklyScopePhotoMap,
                'statusFilters' => [],
                'selectedStatus' => $status,
            ],
        ];
    }

    private function tableMeta($paginator, string $search, string $status = ''): array
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
        ];
    }
}
