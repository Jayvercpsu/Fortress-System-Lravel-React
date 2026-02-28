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

        $query = DeliveryConfirmation::query()
            ->with([
                'foreman:id,fullname',
                'project:id,name',
            ]);

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('item_delivered', 'like', "%{$search}%")
                    ->orWhere('quantity', 'like', "%{$search}%")
                    ->orWhere('supplier', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhere('delivery_date', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));

                if (ctype_digit($search)) {
                    $builder->orWhere('id', (int) $search)
                        ->orWhere('project_id', (int) $search);
                }
            });
        }

        $paginator = $query
            ->latest()
            ->paginate($perPage)
            ->withQueryString();

        $deliveries = collect($paginator->items())
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
            'deliveryTable' => $this->tableMeta($paginator, $search),
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
