<?php

namespace App\Http\Requests\Payrolls;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StorePayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'worker_name' => ['required', 'string'],
            'role' => ['required', 'string'],
            'hours' => ['required', 'numeric', 'min:0'],
            'rate_per_hour' => ['required', 'numeric', 'min:0'],
            'deductions' => ['nullable', 'numeric', 'min:0'],
            'week_start' => ['required', 'date'],
        ];
    }
}
