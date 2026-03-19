<?php

namespace App\Repositories\Contracts;

use App\Models\Material;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface MaterialRepositoryInterface
{
    public function paginateMaterials(string $search, int $perPage): LengthAwarePaginator;

    public function createMaterial(array $attributes): void;

    public function updateMaterial(Material $material, array $attributes): void;

    public function deleteMaterial(Material $material): void;
}
