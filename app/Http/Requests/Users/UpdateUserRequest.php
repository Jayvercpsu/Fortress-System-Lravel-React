<?php

namespace App\Http\Requests\Users;

use App\Models\User;
use App\Models\UserDetail;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        $user = $this->route('user');
        $userId = $user instanceof User ? $user->id : null;

        return [
            'fullname' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email,' . (int) $userId],
            'password' => ['nullable', 'string', 'min:6'],
            'role' => ['required', Rule::in($this->allowedRoles())],
            'birth_date' => [
                'nullable',
                'date',
                'before_or_equal:today',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (blank($value)) {
                        return;
                    }

                    try {
                        $age = Carbon::parse($value)->age;
                    } catch (\Throwable $e) {
                        return;
                    }

                    if ($age <= 18) {
                        $fail(__('messages.users.age_over_18'));
                    }
                },
            ],
            'place_of_birth' => ['nullable', 'string', 'max:255'],
            'sex' => ['nullable', Rule::in(UserDetail::sexOptions())],
            'civil_status' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:500'],
        ];
    }

    private function allowedRoles(): array
    {
        $roles = [User::ROLE_ADMIN, User::ROLE_HR, User::ROLE_FOREMAN, User::ROLE_DESIGNER];

        if ($this->user()?->role === User::ROLE_MASTER_ADMIN) {
            $roles[] = User::ROLE_HEAD_ADMIN;
        }

        return $roles;
    }
}
