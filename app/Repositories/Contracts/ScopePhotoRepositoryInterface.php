<?php

namespace App\Repositories\Contracts;

use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use Illuminate\Http\UploadedFile;

interface ScopePhotoRepositoryInterface
{
    public function createForScope(ProjectScope $scope, UploadedFile $photo, ?string $caption): void;

    public function deleteScopePhoto(ScopePhoto $photo): void;
}
