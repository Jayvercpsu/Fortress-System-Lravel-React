<?php

namespace App\Http\Requests\Monitoring;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class BulkDestroyProjectScopeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'integer', 'distinct', 'exists:project_scopes,id'],
        ];
    }
}
