<?php

namespace App\Http\Controllers;

use App\Models\ScopePhoto;
use App\Models\WeeklyAccomplishment;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class WeeklyAccomplishmentController extends Controller
{
    public function index(Request $request)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $search = trim((string) $request->query('search', ''));
        $allowedPerPage = [5, 10, 25, 50];
        $perPage = (int) $request->query('per_page', 10);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $applySearch = function ($builder) use ($search) {
            if ($search === '') {
                return;
            }

            $builder->where(function ($query) use ($search) {
                $query->where('scope_of_work', 'like', "%{$search}%")
                    ->orWhere('week_start', 'like', "%{$search}%")
                    ->orWhere('percent_completed', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        };

        $projectQuery = WeeklyAccomplishment::query();
        $applySearch($projectQuery);

        $paginator = (clone $projectQuery)
            ->selectRaw('project_id, MAX(created_at) as last_created_at')
            ->groupBy('project_id')
            ->orderByDesc('last_created_at')
            ->paginate($perPage)
            ->withQueryString();

        $projectIds = collect($paginator->items())
            ->map(fn ($item) => $item->project_id ?? null)
            ->values()
            ->unique()
            ->all();
        $status = trim((string) $request->query('status', ''));
        $nonNullProjectIds = array_values(array_filter($projectIds, fn ($value) => $value !== null));
        $hasNullProject = in_array(null, $projectIds, true);

        $accomplishments = collect([]);
        if (!empty($projectIds)) {
            $accomplishmentQuery = WeeklyAccomplishment::query()
                ->with('foreman:id,fullname', 'project:id,name');
            $applySearch($accomplishmentQuery);

            $accomplishmentQuery->where(function ($builder) use ($nonNullProjectIds, $hasNullProject) {
                if (!empty($nonNullProjectIds)) {
                    $builder->whereIn('project_id', $nonNullProjectIds);
                    if ($hasNullProject) {
                        $builder->orWhereNull('project_id');
                    }
                } elseif ($hasNullProject) {
                    $builder->whereNull('project_id');
                } else {
                    $builder->whereRaw('0 = 1');
                }
            });

            $accomplishments = $accomplishmentQuery
                ->latest()
                ->get()
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
        }

        $weeklyScopePhotoMap = [];
        if (!empty($nonNullProjectIds)) {
            $scopePhotos = ScopePhoto::query()
                ->select([
                    'scope_photos.id',
                    'scope_photos.photo_path',
                    'scope_photos.caption',
                    'scope_photos.created_at',
                    'project_scopes.scope_name',
                ])
                ->join('project_scopes', 'project_scopes.id', '=', 'scope_photos.project_scope_id')
                ->whereIn('project_scopes.project_id', $nonNullProjectIds)
                ->orderByDesc('scope_photos.id')
                ->get();

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

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/WeeklyAccomplishments/Index'
            : 'Admin/WeeklyAccomplishments/Index';

        return Inertia::render($page, [
            'weeklyAccomplishments' => $accomplishments,
            'weeklyAccomplishmentTable' => $this->tableMeta($paginator, $search, $status),
            'weeklyScopePhotoMap' => $weeklyScopePhotoMap,
            'statusFilters' => [],
            'selectedStatus' => $status,
        ]);
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
