<?php

namespace App\Http\Requests\Projects;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAssignedForemenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'foreman_names' => ['nullable', 'array'],
            'foreman_names.*' => [
                'required',
                'string',
                'max:255',
                Rule::exists('users', 'fullname')->where(fn ($query) => $query->where('role', User::ROLE_FOREMAN)),
            ],
        ];
    }
}
