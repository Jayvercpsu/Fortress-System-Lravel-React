<?php

namespace App\Services;

use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Repositories\Contracts\ScopePhotoRepositoryInterface;
use Illuminate\Http\UploadedFile;

class ScopePhotoService
{
    public function __construct(
        private readonly ScopePhotoRepositoryInterface $scopePhotoRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function createScopePhoto(ProjectScope $scope, UploadedFile $photo, ?string $caption, ?int $submittedBy = null, ?string $submittedByRole = null): void
    {
        $this->scopePhotoRepository->createForScope($scope, $photo, $caption, $submittedBy, $submittedByRole);
    }

    public function deleteScopePhoto(ScopePhoto $photo): void
    {
        $this->scopePhotoRepository->deleteScopePhoto($photo);
    }
}
