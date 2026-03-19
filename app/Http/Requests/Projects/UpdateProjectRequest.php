<?php

namespace App\Http\Requests\Projects;

use App\Models\User;
use App\Support\Projects\ProjectFlow;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'client' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'max:100'],
            'location' => ['required', 'string', 'max:255'],
            'assigned_role' => [
                'nullable',
                'string',
                'max:255',
                function (string $attribute, mixed $value, \Closure $fail) {
                    $invalid = ProjectFlow::invalidAssignedRoles($value);
                    if (!empty($invalid)) {
                        $fail(__('messages.projects.assigned_role_invalid'));
                    }
                },
            ],
            'assigned' => ['nullable', 'string', 'max:255'],
            'target' => ['nullable', 'date'],
            'status' => ['required', 'string', 'max:50', Rule::in(ProjectFlow::statuses())],
            'phase' => ['required', 'string', 'max:50', Rule::in(ProjectFlow::phases())],
            'overall_progress' => ['prohibited'],
            'contract_amount' => ['prohibited'],
            'design_fee' => ['prohibited'],
            'construction_cost' => ['prohibited'],
            'total_client_payment' => ['prohibited'],
        ];
    }
}
