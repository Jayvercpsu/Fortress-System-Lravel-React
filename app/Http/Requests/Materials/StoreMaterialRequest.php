<?php

namespace App\Http\Requests\Materials;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', 'unique:materials,name'],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
