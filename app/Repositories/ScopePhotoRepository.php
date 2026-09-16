<?php

namespace App\Repositories;

use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Repositories\Contracts\ScopePhotoRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\UploadedFile;

class ScopePhotoRepository implements ScopePhotoRepositoryInterface
{
    public function createForScope(ProjectScope $scope, UploadedFile $photo, ?string $caption, ?int $submittedBy = null, ?string $submittedByRole = null): void
    {
        $path = UploadManager::store($photo, 'scope-photos/' . $scope->id);

        $scope->photos()->create(array_filter([
            'photo_path' => $path,
            'caption' => $caption,
            'submitted_by' => $submittedBy,
            'submitted_by_role' => $submittedByRole,
        ], fn ($value) => $value !== null));
    }

    public function deleteScopePhoto(ScopePhoto $photo): void
    {
        UploadManager::delete($photo->photo_path);
        $photo->delete();
    }
}
