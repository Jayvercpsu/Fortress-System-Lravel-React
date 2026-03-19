<?php

namespace App\Http\Requests\Projects;

use App\Models\User;
use App\Support\Projects\ProjectFlow;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProjectPhaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'phase' => ['required', 'string', 'max:50', Rule::in(ProjectFlow::phaseValidationValues())],
        ];
    }
}
