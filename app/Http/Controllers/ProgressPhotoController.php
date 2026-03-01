<?php

namespace App\Http\Controllers;

use App\Models\ProgressPhoto;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProgressPhotoController extends Controller
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
                $query->where('caption', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        };

        $projectQuery = ProgressPhoto::query();
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

        $photos = collect([]);
        if (!empty($projectIds)) {
            $photoQuery = ProgressPhoto::query()
                ->with(['foreman:id,fullname', 'project:id,name']);
            $applySearch($photoQuery);

            $nonNullProjectIds = array_values(array_filter($projectIds, fn ($value) => $value !== null));
            $hasNullProject = in_array(null, $projectIds, true);

            $photoQuery->where(function ($builder) use ($nonNullProjectIds, $hasNullProject) {
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

            $photos = $photoQuery
                ->latest()
                ->get()
                ->sortBy(function (ProgressPhoto $photo) use ($projectIds) {
                    $targetKey = $photo->project_id === null ? '__null__' : (string) $photo->project_id;
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

        $photos = $photos
            ->map(fn (ProgressPhoto $photo) => [
                'id' => $photo->id,
                'photo_path' => $photo->photo_path,
                'caption' => $photo->caption,
                'foreman_name' => $photo->foreman?->fullname ?? 'Unknown',
                'project_id' => $photo->project_id,
                'project_name' => $photo->project?->name ?? 'Unassigned',
                'created_at' => optional($photo->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/ProgressPhotos/Index'
            : 'Admin/ProgressPhotos/Index';

        return Inertia::render($page, [
            'photos' => $photos,
            'photoTable' => $this->tableMeta($paginator, $search),
        ]);
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
