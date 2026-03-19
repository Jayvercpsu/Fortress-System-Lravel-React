<?php

namespace App\Services;

use App\Repositories\Contracts\StorageProxyRepositoryInterface;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StorageProxyService
{
    public function __construct(
        private readonly StorageProxyRepositoryInterface $storageProxyRepository
    ) {
    }

    public function streamFile(string $path): StreamedResponse
    {
        $normalizedPath = ltrim($path, '/');
        if ($normalizedPath === '' || str_contains($normalizedPath, '..')) {
            abort(404);
        }

        if (!$this->storageProxyRepository->fileExists($normalizedPath)) {
            abort(404);
        }

        return $this->storageProxyRepository->streamResponse($normalizedPath);
    }
}
