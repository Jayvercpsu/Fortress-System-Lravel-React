<?php

namespace App\Http\Controllers;

use App\Models\MaterialRequest;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

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

        $applySearch = function ($builder) use ($search) {
            if ($search === '') {
                return;
            }

            $builder->where(function ($query) use ($search) {
                $query->where('material_name', 'like', "%{$search}%")
                    ->orWhere('quantity', 'like', "%{$search}%")
                    ->orWhere('unit', 'like', "%{$search}%")
                    ->orWhere('remarks', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%")
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('foreman', fn ($q) => $q->where('fullname', 'like', "%{$search}%"));
            });
        };

        $projectQuery = MaterialRequest::query();
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

        $requests = collect([]);
        if (!empty($projectIds)) {
            $requestsQuery = MaterialRequest::query()
                ->with(['foreman:id,fullname', 'project:id,name']);
            $applySearch($requestsQuery);

            $nonNullProjectIds = array_values(array_filter($projectIds, fn ($value) => $value !== null));
            $hasNullProject = in_array(null, $projectIds, true);

            $requestsQuery->where(function ($builder) use ($nonNullProjectIds, $hasNullProject) {
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

            $requests = $requestsQuery
                ->latest()
                ->get()
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
                ->values();
        }

        $requests = $requests
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
            'materialRequestTable' => $this->tableMeta($projectPaginator, $search),
        ]);
    }

    public function updateStatus(Request $request, MaterialRequest $materialRequest)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate([
            'status' => ['required', 'in:pending,approved,rejected'],
        ]);

        if ((string) $materialRequest->status === (string) $validated['status']) {
            return redirect()->back()->with('success', 'Status already ' . $validated['status'] . '.');
        }

        $materialRequest->update([
            'status' => $validated['status'],
        ]);

        return redirect()->back()->with('success', 'Material request marked as ' . $validated['status'] . '.');
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
