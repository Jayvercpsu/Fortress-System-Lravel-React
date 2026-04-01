<?php

namespace App\Http\Requests\Monitoring;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReorderProjectScopesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $project = $this->route('project');
        $projectId = $project instanceof Project ? $project->id : (int) $project;

        return [
            'scope_ids' => ['required', 'array', 'min:1'],
            'scope_ids.*' => [
                'integer',
                Rule::exists('project_scopes', 'id')->where('project_id', $projectId),
            ],
        ];
    }
}
