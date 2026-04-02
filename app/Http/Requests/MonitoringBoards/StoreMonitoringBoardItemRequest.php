<?php

namespace App\Http\Requests\MonitoringBoards;

use App\Models\MonitoringBoardItem;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMonitoringBoardItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'department' => [
                'required',
                'string',
                'max:120',
                function (string $attribute, mixed $value, callable $fail) {
                    if (strcasecmp(trim((string) $value), 'completed') === 0) {
                        $fail('Completed is reserved and cannot be used as a department name.');
                    }
                },
            ],
            'client_name' => ['required', 'string', 'max:255'],
            'project_name' => ['required', 'string', 'max:255'],
            'project_type' => ['required', 'string', 'max:100'],
            'location' => ['required', 'string', 'max:255'],
            'assigned_to' => ['nullable', 'string', 'max:255'],
            'status' => ['required', 'string', 'max:50', Rule::in(MonitoringBoardItem::statusOptions())],
            'start_date' => ['nullable', 'date'],
            'timeline' => ['nullable', 'string', 'max:255'],
            'due_date' => ['nullable', 'date'],
            'date_paid' => ['nullable', 'date'],
            'progress_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'design_contract_amount' => ['nullable', 'numeric', 'min:0'],
            'downpayment' => ['nullable', 'numeric', 'min:0'],
            'total_received' => ['nullable', 'numeric', 'min:0'],
            'office_payroll_deduction' => ['nullable', 'numeric', 'min:0'],
            'client_approval_status' => ['nullable', 'string', 'max:20', Rule::in(['pending', 'approved', 'rejected'])],
            'design_computation_basis' => ['nullable', 'array'],
            'design_computation_basis.*.key' => ['nullable', 'string', 'max:100'],
            'design_computation_basis.*.label' => ['nullable', 'string', 'max:255'],
            'design_computation_basis.*.percent' => ['nullable', 'numeric', 'min:0'],
            'design_computation_basis.*.progress' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }
}
