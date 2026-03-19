<?php

namespace App\Services;

use App\Models\DeliveryConfirmation;
use App\Models\User;
use App\Repositories\Contracts\DeliveryConfirmationRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class DeliveryConfirmationService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly DeliveryConfirmationRepositoryInterface $deliveryConfirmationRepository
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
            $projectPaginator = $this->deliveryConfirmationRepository->paginateNonDesignProjects($perPage);

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
            $projectPaginator = $this->deliveryConfirmationRepository->paginateDeliveryProjectIds($search, $status, $perPage);

            $projectIds = collect($projectPaginator->items())
                ->map(fn ($item) => $item->project_id ?? null)
                ->values()
                ->unique()
                ->all();
        }

        $deliveries = $this->deliveryConfirmationRepository->listByProjectIds($projectIds, $search, $status);
        if (!$deliveries instanceof Collection) {
            $deliveries = collect($deliveries);
        }

        $deliveries = $deliveries
            ->sortBy(function (DeliveryConfirmation $row) use ($projectIds) {
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
            ->map(fn (DeliveryConfirmation $row) => [
                'id' => $row->id,
                'project_id' => $row->project_id,
                'project_name' => $row->project?->name,
                'foreman_name' => $row->foreman?->fullname ?? 'Unknown',
                'item_delivered' => $row->item_delivered,
                'quantity' => $row->quantity,
                'delivery_date' => $row->delivery_date,
                'supplier' => $row->supplier,
                'status' => $row->status,
                'photo_path' => $row->photo_path,
                'created_at' => optional($row->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Delivery/Index'
            : 'Admin/Delivery/Index';

        return [
            'page' => $page,
            'props' => [
                'deliveries' => $deliveries,
                'projects' => $projects,
                'deliveryTable' => $this->tableMeta($projectPaginator, $search, $status),
                'statusFilters' => DeliveryConfirmation::statusOptions(),
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
