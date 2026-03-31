<?php

namespace App\Http\Requests\Designs;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class UpdateDesignerTrackingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'work_started_at' => ['nullable', 'date'],
            'work_completed_at' => ['nullable', 'date'],
        ];
    }
}
