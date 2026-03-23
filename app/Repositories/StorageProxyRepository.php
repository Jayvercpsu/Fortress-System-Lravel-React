<?php

namespace App\Repositories;

use App\Repositories\Contracts\StorageProxyRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StorageProxyRepository implements StorageProxyRepositoryInterface
{
    public function fileExists(string $path): bool
    {
        try {
            return Storage::disk($this->disk())->fileExists($path);
        } catch (\Throwable $e) {
            Log::warning('StorageProxy: file existence check failed', [
                'disk' => $this->disk(),
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
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
