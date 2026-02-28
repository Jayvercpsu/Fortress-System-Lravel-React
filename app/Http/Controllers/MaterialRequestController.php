<?php

namespace App\Http\Controllers;

use App\Models\MaterialRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MaterialRequestController extends Controller
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

        $query = MaterialRequest::query()
            ->with(['foreman:id,fullname', 'project:id,name']);

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('material_name', 'like', "%{$search}%")
                    ->orWhere('quantity', 'like', "%{$search}%")
                    ->orWhere('unit', 'like', "%{$search}%")
                    ->orWhere('remarks', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"));
            });
        }

        $paginator = $query
            ->latest()
            ->paginate($perPage)
            ->withQueryString();

        $requests = collect($paginator->items())
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

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Materials/Index'
            : 'Admin/Materials/Index';

        return Inertia::render($page, [
            'materialRequests' => $requests,
            'materialRequestTable' => $this->tableMeta($paginator, $search),
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
