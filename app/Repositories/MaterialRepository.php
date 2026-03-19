<?php

namespace App\Repositories;

use App\Models\Material;
use App\Repositories\Contracts\MaterialRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class MaterialRepository implements MaterialRepositoryInterface
{
    public function paginateMaterials(string $search, int $perPage): LengthAwarePaginator
    {
        $query = Material::query();

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return $query
            ->orderBy('name')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function createMaterial(array $attributes): void
    {
        Material::query()->create($attributes);
    }

    public function updateMaterial(Material $material, array $attributes): void
    {
        $material->update($attributes);
    }

    public function deleteMaterial(Material $material): void
    {
        $material->delete();
    }
}
