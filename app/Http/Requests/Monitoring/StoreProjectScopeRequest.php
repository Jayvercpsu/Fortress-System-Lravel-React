<?php

namespace App\Http\Requests\Monitoring;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreProjectScopeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'scope_name' => ['required', 'string', 'max:255'],
            'assigned_personnel' => ['nullable', 'string', 'max:255', 'regex:/^[^,;|]+$/'],
            'progress_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'pm_progress_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'status' => ['required', 'string', 'max:50'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'contract_amount' => ['required', 'numeric', 'min:0'],
            'weight_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'start_date' => ['nullable', 'date'],
            'target_completion' => ['nullable', 'date'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'progress_percent' => $this->normalizeIntegerLike($this->input('progress_percent')),
            'pm_progress_percent' => $this->normalizeNullableIntegerLike($this->input('pm_progress_percent')),
        ]);
    }

    private function normalizeIntegerLike(mixed $value): mixed
    {
        if (!is_string($value)) {
            return $value;
        }
        $trimmed = trim($value);
        if ($trimmed === '') {
            return $value;
        }
        if (preg_match('/^-?0+\d+$/', $trimmed)) {
            return (int) $trimmed;
        }

        return $value;
    }

    private function normalizeNullableIntegerLike(mixed $value): mixed
    {
        if ($value === '' || $value === null) {
            return null;
        }

        return $this->normalizeIntegerLike($value);
    }
}
