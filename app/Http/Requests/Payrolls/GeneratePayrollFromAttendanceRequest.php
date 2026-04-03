<?php

namespace App\Http\Requests\Payrolls;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class GeneratePayrollFromAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        $group = strtolower((string) $this->query('group', 'workers'));
        $projectRule = $group === 'staff'
            ? ['nullable', 'integer', 'exists:projects,id']
            : ['required', 'integer', 'exists:projects,id'];

        return [
            'project_id' => $projectRule,
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
        ];
    }
}
