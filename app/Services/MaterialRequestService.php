<?php

namespace App\Services;

use App\Models\MaterialRequest;
use App\Models\User;
use App\Repositories\Contracts\MaterialRequestRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class MaterialRequestService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly MaterialRequestRepositoryInterface $materialRequestRepository
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
            $projectPaginator = $this->materialRequestRepository->paginateNonDesignProjects($perPage);

            $projectIds = collect($projectPaginator->items())
                ->map(fn ($item) => $item->id ?? null)
                ->values()
                ->unique()
                ->all();

            $projects = collect($projectPaginator->items())
                ->map(fn ($project) => [
                    'id' => $project->id,
                    'name' => $project->name,
                ])
                ->values();
        } else {
            $projectPaginator = $this->materialRequestRepository->paginateMaterialRequestProjectIds($search, $status, $perPage);

            $projectIds = collect($projectPaginator->items())
                ->map(fn ($item) => $item->project_id ?? null)
                ->values()
                ->unique()
                ->all();
        }

        $requests = $this->materialRequestRepository->listByProjectIds($projectIds, $search, $status);
        if (!$requests instanceof Collection) {
            $requests = collect($requests);
        }

        $requests = $requests
            ->sortBy(function (MaterialRequest $row) use ($projectIds) {
                $targetKey = $row->project_id === null ? '__null__' : (string) $row->project_id;
                foreach ($projectIds as $index => $projectId) {
                    $currentKey = $projectId === null ? '__null__' : (string) $projectId;
                    if ($currentKey === $targetKey) {
                        return $index;
                    }
                }

                return PHP_INT_MAX;
            })
            ->values()
            ->map(fn (MaterialRequest $row) => [
                'id' => $row->id,
                'project_id' => $row->project_id,
                'project_name' => $row->project?->name,
                'foreman_name' => $row->foreman?->fullname ?? 'Unknown',
                'material_name' => $row->material_name,
                'quantity' => $row->quantity,
                'unit' => $row->unit,
                'remarks' => $row->remarks,
                'status' => $row->status,
                'photo_path' => $row->photo_path,
                'created_at' => optional($row->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Materials/Index'
            : 'Admin/Materials/Index';

        return [
            'page' => $page,
            'props' => [
                'materialRequests' => $requests,
                'projects' => $projects,
                'materialRequestTable' => $this->tableMeta($projectPaginator, $search, $status),
                'statusFilters' => MaterialRequest::statusOptions(),
                'selectedStatus' => $status,
            ],
        ];
    }

    public function updateStatus(MaterialRequest $materialRequest, string $status): string
    {
        if ((string) $materialRequest->status === $status) {
            return __('messages.material_requests.status_already', ['status' => $status]);
        }

        $this->materialRequestRepository->updateStatus($materialRequest, $status);

        return __('messages.material_requests.status_marked', ['status' => $status]);
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
