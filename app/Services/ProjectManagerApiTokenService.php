<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Crypt;

class ProjectManagerApiTokenService
{
    public const TOKEN_TTL_MINUTES = 60 * 24;

    public function expiresAt(): \Carbon\CarbonInterface
    {
        return now()->addMinutes(self::TOKEN_TTL_MINUTES);
    }

    public function issue(User $user): string
    {
        $payload = [
            'uid' => $user->id,
            'role' => $user->role,
            'iat' => now()->timestamp,
            'exp' => now()->addMinutes(self::TOKEN_TTL_MINUTES)->timestamp,
        ];

        return Crypt::encryptString(json_encode($payload));
    }

    public function resolve(string $token): ?User
    {
        try {
            $decoded = json_decode(Crypt::decryptString($token), true);
        } catch (\Throwable) {
            return null;
        }

        if (!is_array($decoded) || ($decoded['exp'] ?? 0) < now()->timestamp) {
            return null;
        }

        $user = User::find($decoded['uid'] ?? null);

        if (!$user || $user->role !== User::ROLE_PROJECT_MANAGER) {
            return null;
        }

        return $user;
    }
}
