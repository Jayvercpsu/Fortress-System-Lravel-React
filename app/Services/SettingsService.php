<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\Contracts\SettingsRepositoryInterface;
use Illuminate\Support\Carbon;

class SettingsService
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settingsRepository
    ) {
    }

    public function getSettingsPayload(User $user): array
    {
        $resolvedUser = $this->settingsRepository->loadAccount($user);
        $detail = $resolvedUser->detail;

        return [
            'fullname' => $resolvedUser->fullname ?? '',
            'email' => $resolvedUser->email ?? '',
            'role' => $resolvedUser->role ?? '',
            'profile_photo_path' => $detail?->profile_photo_path ?? '',
            'birth_date' => optional($detail?->birth_date)->toDateString(),
            'place_of_birth' => $detail?->place_of_birth ?? '',
            'sex' => $detail?->sex ?? '',
            'civil_status' => $detail?->civil_status ?? '',
            'phone' => $detail?->phone ?? '',
            'address' => $detail?->address ?? '',
        ];
    }

    public function updateSettings(User $user, array $validated): void
    {
        $resolvedUser = $this->settingsRepository->updateAccount($user, $validated);
        $resolvedUser->load('detail');

        $detailData = $this->detailPayloadFromValidated($validated);
        if (!empty($validated['profile_photo'])) {
            $detailData['profile_photo_path'] = $this->settingsRepository->replaceProfilePhoto(
                $resolvedUser,
                $validated['profile_photo']
            );
        }

        $this->settingsRepository->upsertDetail($resolvedUser, $detailData);
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
}
