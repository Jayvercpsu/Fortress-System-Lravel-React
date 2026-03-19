<?php

namespace App\Services;

use App\Models\Material;
use App\Models\User;
use App\Repositories\Contracts\MaterialRepositoryInterface;
use Illuminate\Http\Request;

class MaterialService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly MaterialRepositoryInterface $materialRepository
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

        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        $paginator = $this->materialRepository->paginateMaterials($search, $perPage);

        $materials = collect($paginator->items())
            ->map(fn (Material $material) => [
                'id' => $material->id,
                'name' => $material->name,
                'description' => $material->description,
                'created_at' => optional($material->created_at)?->toDateTimeString(),
            ])
            ->values();

        return [
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
        ];
    }

    public function pageByRole(User $user): string
    {
        return $user->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Materials/Index'
            : 'Admin/Materials/Index';
    }

    public function createMaterial(array $validated): void
    {
        $this->materialRepository->createMaterial($validated);
    }

    public function updateMaterial(Material $material, array $validated): void
    {
        $this->materialRepository->updateMaterial($material, $validated);
    }

    public function deleteMaterial(Material $material): void
    {
        $this->materialRepository->deleteMaterial($material);
    }

    public function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }
}
