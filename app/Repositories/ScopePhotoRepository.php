<?php

namespace App\Repositories;

use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Repositories\Contracts\ScopePhotoRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\UploadedFile;

class ScopePhotoRepository implements ScopePhotoRepositoryInterface
{
    public function createForScope(ProjectScope $scope, UploadedFile $photo, ?string $caption): void
    {
        $path = UploadManager::store($photo, 'scope-photos/' . $scope->id);

        $scope->photos()->create([
            'photo_path' => $path,
            'caption' => $caption,
        ]);
    }

    public function deleteScopePhoto(ScopePhoto $photo): void
    {
        UploadManager::delete($photo->photo_path);
        $photo->delete();
    }
}
