<?php

namespace App\Http\Requests\MaterialRequests;

use App\Models\MaterialRequest;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMaterialRequestStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(MaterialRequest::statusOptions())],
        ];
    }
}
