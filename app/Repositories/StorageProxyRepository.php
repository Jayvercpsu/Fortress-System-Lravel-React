<?php

namespace App\Repositories;

use App\Repositories\Contracts\StorageProxyRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StorageProxyRepository implements StorageProxyRepositoryInterface
{
    public function fileExists(string $path): bool
    {
        return Storage::disk($this->disk())->exists($path);
    }

    public function streamResponse(string $path): StreamedResponse
    {
        return Storage::disk($this->disk())->response($path);
    }

    private function disk(): string
    {
        return UploadManager::disk();
    }
}
