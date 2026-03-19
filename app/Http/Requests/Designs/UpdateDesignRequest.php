<?php

namespace App\Http\Requests\Designs;

use App\Models\DesignProject;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDesignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'design_contract_amount' => ['required', 'numeric', 'min:0'],
            'downpayment' => ['required', 'numeric', 'min:0'],
            'total_received' => ['required', 'numeric', 'min:0'],
            'office_payroll_deduction' => ['required', 'numeric', 'min:0'],
            'client_approval_status' => ['required', Rule::in(DesignProject::clientApprovalStatuses())],
        ];
    }
}
