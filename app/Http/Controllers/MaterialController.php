<?php

namespace App\Http\Controllers;

use App\Models\Material;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class MaterialController extends Controller
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

        $query = Material::query();
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $paginator = $query
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();

        $materials = collect($paginator->items())
            ->map(fn (Material $material) => [
                'id' => $material->id,
                'name' => $material->name,
                'description' => $material->description,
                'created_at' => optional($material->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Materials/Index'
            : 'Admin/Materials/Index';

        return Inertia::render($page, [
            'materials' => $materials,
            'materialTable' => [
                'search' => $search,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:materials,name'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        Material::create($validated);

        return redirect()
            ->route('materials.index', $this->tableQueryParams($request))
            ->with('success', 'Material added.');
    }

    public function update(Request $request, Material $material)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('materials', 'name')->ignore($material->id)],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $material->update($validated);

        return redirect()
            ->route('materials.index', $this->tableQueryParams($request))
            ->with('success', 'Material updated.');
    }

    public function destroy(Request $request, Material $material)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $material->delete();

        return redirect()
            ->route('materials.index', $this->tableQueryParams($request))
            ->with('success', 'Material deleted.');
    }

    private function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }
}
