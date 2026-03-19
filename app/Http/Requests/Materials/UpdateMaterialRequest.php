<?php

namespace App\Http\Requests\Materials;

use App\Models\Material;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        $material = $this->route('material');
        $materialId = $material instanceof Material ? $material->id : null;

        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('materials', 'name')->ignore($materialId)],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
