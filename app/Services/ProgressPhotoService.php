<?php

namespace App\Services;

use App\Models\ProgressPhoto;
use App\Models\User;
use App\Repositories\Contracts\ProgressPhotoRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ProgressPhotoService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly ProgressPhotoRepositoryInterface $progressPhotoRepository
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
            $paginator = $this->progressPhotoRepository->paginateNonDesignProjects($perPage);

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
            $paginator = $this->progressPhotoRepository->paginatePhotoProjectIds($search, $perPage);

            $projectIds = collect($paginator->items())
                ->map(fn ($item) => $item->project_id ?? null)
                ->values()
                ->unique()
                ->all();
        }

        $photos = $this->progressPhotoRepository->listByProjectIds($projectIds, $search);
        if (!$photos instanceof Collection) {
            $photos = collect($photos);
        }

        $photos = $photos
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
            ->values()
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

        $page = $request->user()->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/ProgressPhotos/Index'
            : 'Admin/ProgressPhotos/Index';

        return [
            'page' => $page,
            'props' => [
                'photos' => $photos,
                'projects' => $projects,
                'photoTable' => $this->tableMeta($paginator, $search, $status),
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
