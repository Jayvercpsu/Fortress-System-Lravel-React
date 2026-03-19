<?php

namespace App\Http\Requests\MonitoringBoards;

use App\Models\MonitoringBoardItem;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMonitoringBoardItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'department' => ['required', 'string', 'max:120'],
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
        ];
    }
}
