<?php

namespace App\Http\Controllers;

use App\Models\DeliveryConfirmation;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeliveryConfirmationController extends Controller
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
                $query->where('item_delivered', 'like', "%{$search}%")
                    ->orWhere('quantity', 'like', "%{$search}%")
                    ->orWhere('supplier', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('delivery_date', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));

                if (ctype_digit($search)) {
                    $query->orWhere('id', (int) $search)
                        ->orWhere('project_id', (int) $search);
                }
            });
        };

        $projectQuery = DeliveryConfirmation::query();
        $applySearch($projectQuery);

        $projectPaginator = (clone $projectQuery)
            ->selectRaw('project_id, MAX(created_at) as last_created_at')
            ->groupBy('project_id')
            ->orderByDesc('last_created_at')
            ->paginate($perPage)
            ->withQueryString();

        $projectIds = collect($projectPaginator->items())
            ->map(fn ($item) => $item->project_id ?? null)
            ->values()
            ->unique()
            ->all();

        $deliveries = collect([]);
        if (!empty($projectIds)) {
            $deliveryQuery = DeliveryConfirmation::query()
                ->with([
                    'foreman:id,fullname',
                    'project:id,name',
                ]);
            $applySearch($deliveryQuery);

            $nonNullProjectIds = array_values(array_filter($projectIds, fn ($value) => $value !== null));
            $hasNullProject = in_array(null, $projectIds, true);

            $deliveryQuery->where(function ($builder) use ($nonNullProjectIds, $hasNullProject) {
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

            $deliveries = $deliveryQuery
                ->latest()
                ->get()
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
                ->values();
        }

        $deliveries = $deliveries
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

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Delivery/Index'
            : 'Admin/Delivery/Index';

        return Inertia::render($page, [
            'deliveries' => $deliveries,
            'deliveryTable' => $this->tableMeta($projectPaginator, $search),
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
