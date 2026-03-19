<?php

namespace App\Http\Requests\Projects;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProjectFinancialsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'contract_amount' => ['required', 'numeric', 'min:0'],
            'design_fee' => ['required', 'numeric', 'min:0'],
            'construction_cost' => ['required', 'numeric', 'min:0'],
            'total_client_payment' => ['required', 'numeric', 'min:0'],
        ];
    }
}
