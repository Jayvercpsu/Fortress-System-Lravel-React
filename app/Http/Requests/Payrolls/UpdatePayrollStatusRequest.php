<?php

namespace App\Http\Requests\Payrolls;

use App\Models\Payroll;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePayrollStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(Payroll::statusOptions())],
        ];
    }
}
