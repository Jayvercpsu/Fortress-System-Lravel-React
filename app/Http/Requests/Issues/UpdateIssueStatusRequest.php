<?php

namespace App\Http\Requests\Issues;

use App\Models\IssueReport;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateIssueStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(IssueReport::statusOptions())],
        ];
    }
}
