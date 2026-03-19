<?php

namespace App\Http\Controllers;

use App\Http\Requests\Materials\StoreMaterialRequest;
use App\Http\Requests\Materials\UpdateMaterialRequest;
use App\Models\Material;
use App\Services\MaterialService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MaterialController extends Controller
{
    public function __construct(
        private readonly MaterialService $materialService
    ) {
    }

    public function index(Request $request)
    {
        $this->materialService->ensureAuthorized($request->user());

        $page = $this->materialService->pageByRole($request->user());

        return Inertia::render($page, [
            ...$this->materialService->indexPayload($request),
        ]);
    }

    public function store(StoreMaterialRequest $request)
    {
        $this->materialService->ensureAuthorized($request->user());
        $this->materialService->createMaterial($request->validated());

        return redirect()
            ->route('materials.index', $this->materialService->tableQueryParams($request))
            ->with('success', __('messages.materials.created'));
    }

    public function update(UpdateMaterialRequest $request, Material $material)
    {
        $this->materialService->ensureAuthorized($request->user());
        $this->materialService->updateMaterial($material, $request->validated());

        return redirect()
            ->route('materials.index', $this->materialService->tableQueryParams($request))
            ->with('success', __('messages.materials.updated'));
    }

    public function destroy(Request $request, Material $material)
    {
        $this->materialService->ensureAuthorized($request->user());
        $this->materialService->deleteMaterial($material);

        return redirect()
            ->route('materials.index', $this->materialService->tableQueryParams($request))
            ->with('success', __('messages.materials.deleted'));
    }
}
