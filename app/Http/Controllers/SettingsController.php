<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class SettingsController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user()->load('detail');

        return Inertia::render('Settings/Index', [
            'account' => $this->settingsPayload($user),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate($this->rules($user));

        $user->fullname = $validated['fullname'];
        $user->email = $validated['email'];

        if (!empty($validated['password'])) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        $user->detail()->updateOrCreate(
            ['user_id' => $user->id],
            $this->detailPayloadFromValidated($validated)
        );

        return redirect()->route('settings.index');
    }

    private function rules(User $user): array
    {
        return [
            'fullname' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:6|confirmed',
            'birth_date' => [
                'nullable',
                'date',
                'before_or_equal:today',
                function ($attribute, $value, $fail) {
                    if (blank($value)) {
                        return;
                    }

                    try {
                        $age = Carbon::parse($value)->age;
                    } catch (\Throwable $e) {
                        return;
                    }

                    if ($age <= 18) {
                        $fail('The user must be older than 18 years old.');
                    }
                },
            ],
            'place_of_birth' => 'nullable|string|max:255',
            'sex' => 'nullable|in:male,female,other',
            'civil_status' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:500',
        ];
    }

    private function detailPayloadFromValidated(array $validated): array
    {
        $birthDate = !empty($validated['birth_date']) ? Carbon::parse($validated['birth_date']) : null;

        return [
            'age' => $birthDate?->age,
            'birth_date' => $birthDate?->toDateString(),
            'place_of_birth' => $validated['place_of_birth'] ?? null,
            'sex' => $validated['sex'] ?? null,
            'civil_status' => $validated['civil_status'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['address'] ?? null,
        ];
    }

    private function settingsPayload(User $user): array
    {
        $detail = $user->detail;

        return [
            'fullname' => $user->fullname ?? '',
            'email' => $user->email ?? '',
            'role' => $user->role ?? '',
            'birth_date' => optional($detail?->birth_date)->toDateString(),
            'place_of_birth' => $detail?->place_of_birth ?? '',
            'sex' => $detail?->sex ?? '',
            'civil_status' => $detail?->civil_status ?? '',
            'phone' => $detail?->phone ?? '',
            'address' => $detail?->address ?? '',
        ];
    }
}
