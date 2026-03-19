<?php

namespace App\Http\Requests\Builds;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class UpdateBuildTrackerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'construction_contract' => ['required', 'numeric', 'min:0'],
            'total_client_payment' => ['required', 'numeric', 'min:0'],
            'materials_cost' => ['nullable', 'numeric', 'min:0'],
            'labor_cost' => ['nullable', 'numeric', 'min:0'],
            'equipment_cost' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
