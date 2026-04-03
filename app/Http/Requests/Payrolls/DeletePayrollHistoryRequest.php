<?php

namespace App\Http\Requests\Payrolls;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class DeletePayrollHistoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'cutoff_id' => ['required', 'integer', 'exists:payroll_cutoffs,id'],
            'project_id' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
