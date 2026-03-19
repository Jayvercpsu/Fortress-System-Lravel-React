<?php

namespace App\Http\Requests\Payrolls;

use App\Models\Payroll;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'worker_name' => ['required', 'string', 'max:255'],
            'role' => ['required', 'string', 'max:255'],
            'week_start' => ['required', 'date'],
            'hours' => ['required', 'numeric', 'min:0'],
            'rate_per_hour' => ['required', 'numeric', 'min:0'],
            'deductions' => ['nullable', 'numeric', 'min:0'],
            'status' => ['required', Rule::in(Payroll::statusOptions())],
        ];
    }
}
