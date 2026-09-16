<?php

namespace App\Support;

use App\Models\User;

/**
 * "Submitted by" label for scope photos.
 *
 * The recorded uploader (submitter relation) always wins; caption tags are
 * only a fallback for photos uploaded before uploaders were recorded.
 *
 * @return array{name: string|null, type: string|null}
 */
class ScopePhotoAttribution
{
    public static function resolve(
        ?User $submitter,
        ?string $caption,
        ?string $pmName = null,
        ?string $foremanName = null
    ): array {
        if ($submitter !== null) {
            $name = trim((string) ($submitter->fullname ?? ''));

            return [
                'name' => $name !== '' ? $name : null,
                'type' => self::roleLabel((string) ($submitter->role ?? '')),
            ];
        }

        $tag = trim((string) ($caption ?? ''));

        if (str_starts_with($tag, '[PM Weekly]')) {
            $name = trim((string) ($pmName ?? ''));

            return ['name' => $name !== '' ? $name : null, 'type' => 'PM'];
        }

        if (str_starts_with($tag, '[Jotform Weekly]')) {
            $name = trim((string) ($foremanName ?? ''));

            return ['name' => $name !== '' ? $name : null, 'type' => 'Foreman'];
        }

        return ['name' => null, 'type' => null];
    }

    public static function roleLabel(string $role): ?string
    {
        return match (strtolower(trim($role))) {
            User::ROLE_PROJECT_MANAGER => 'PM',
            User::ROLE_FOREMAN => 'Foreman',
            User::ROLE_MASTER_ADMIN => 'Master Admin',
            User::ROLE_HEAD_ADMIN => 'Head Admin',
            User::ROLE_ADMIN => 'Admin',
            User::ROLE_DESIGNER => 'Designer',
            User::ROLE_HR => 'HR',
            User::ROLE_CLIENT => 'Client',
            '' => null,
            default => ucwords(str_replace('_', ' ', trim($role))),
        };
    }
}
