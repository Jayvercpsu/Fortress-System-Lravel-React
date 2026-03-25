<?php

namespace App\Http\Requests\HrWorkers;

use App\Models\User;
use App\Models\UserDetail;
use App\Models\Worker;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateHrWorkerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'foreman_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', User::ROLE_FOREMAN)),
            ],
            'project_id' => ['required', 'integer', Rule::exists('projects', 'id')],
            'name' => ['required', 'string', 'max:255'],
            'job_type' => ['nullable', Rule::in(Worker::jobTypeOptions())],
            'birth_date' => ['nullable', 'date', 'before_or_equal:today'],
            'place_of_birth' => ['nullable', 'string', 'max:255'],
            'sex' => ['nullable', Rule::in(UserDetail::sexOptions())],
            'civil_status' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:500'],
        ];
    }
}
