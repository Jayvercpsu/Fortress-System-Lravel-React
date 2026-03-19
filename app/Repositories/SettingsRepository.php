<?php

namespace App\Repositories;

use App\Models\User;
use App\Repositories\Contracts\SettingsRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;

class SettingsRepository implements SettingsRepositoryInterface
{
    public function loadAccount(User $user): User
    {
        return $user->load('detail');
    }

    public function updateAccount(User $user, array $validated): User
    {
        $user->fullname = (string) $validated['fullname'];
        $user->email = (string) $validated['email'];

        if (!empty($validated['password'])) {
            $user->password = Hash::make((string) $validated['password']);
        }

        $user->save();

        return $user;
    }

    public function upsertDetail(User $user, array $detailData): void
    {
        $user->detail()->updateOrCreate(
            ['user_id' => $user->id],
            $detailData
        );
    }

    public function replaceProfilePhoto(User $user, UploadedFile $photo): string
    {
        $detail = $user->detail;
        UploadManager::delete($detail?->profile_photo_path);

        return UploadManager::store($photo, 'profile-photos/' . $user->id);
    }
}
