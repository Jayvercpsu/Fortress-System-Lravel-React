<?php

namespace App\Repositories\Contracts;

use App\Models\User;
use Illuminate\Http\UploadedFile;

interface SettingsRepositoryInterface
{
    public function loadAccount(User $user): User;

    public function updateAccount(User $user, array $validated): User;

    public function upsertDetail(User $user, array $detailData): void;

    public function replaceProfilePhoto(User $user, UploadedFile $photo): string;
}
