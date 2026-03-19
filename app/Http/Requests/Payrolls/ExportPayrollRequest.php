<?php

namespace App\Http\Requests\Payrolls;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class ExportPayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'cutoff_id' => ['required', 'exists:payroll_cutoffs,id'],
        ];
    }
}
