<?php

namespace App\Http\Requests\Settings;

use App\Models\User;
use App\Models\UserDetail;
use App\Support\Uploads\UploadManager;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        /** @var User|null $user */
        $user = $this->user();

        return [
            'fullname' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email,' . (int) ($user?->id ?? 0)],
            'password' => ['nullable', 'string', 'min:6', 'confirmed'],
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
                        $fail(__('messages.settings.age_over_18'));
                    }
                },
            ],
            'place_of_birth' => ['nullable', 'string', 'max:255'],
            'sex' => ['nullable', Rule::in(UserDetail::sexOptions())],
            'civil_status' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:500'],
            'profile_photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,gif,webp', UploadManager::maxRule()],
        ];
    }
}
