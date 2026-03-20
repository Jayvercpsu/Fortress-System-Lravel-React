<?php

namespace App\Http\Requests\Attendances;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User
            && in_array($this->user()->role, User::manageableRoles(), true);
    }

    public function rules(): array
    {
        return [
            'attendance' => ['required', 'array', 'min:1'],
            'attendance.*.foreman_id' => [
                'required',
                Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', User::ROLE_FOREMAN)),
            ],
            'attendance.*.project_id' => ['nullable', 'exists:projects,id'],
            'attendance.*.time_in' => ['nullable', 'date_format:H:i'],
            'attendance.*.time_out' => ['nullable', 'date_format:H:i'],
        ];
    }
}
