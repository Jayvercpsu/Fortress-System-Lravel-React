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

    public function streamFile(string $path, bool $forceDownload = false, ?string $downloadName = null): StreamedResponse
    {
        $normalizedPath = ltrim($path, '/');
        if ($normalizedPath === '' || str_contains($normalizedPath, '..')) {
            abort(404);
        }

        if (!$this->storageProxyRepository->fileExists($normalizedPath)) {
            abort(404);
        }

        if ($forceDownload) {
            return $this->storageProxyRepository->downloadResponse(
                $normalizedPath,
                $this->sanitizeDownloadName($downloadName)
            );
        }

        return $this->storageProxyRepository->streamResponse($normalizedPath);
    }

    private function sanitizeDownloadName(?string $name): ?string
    {
        $raw = trim((string) $name);
        if ($raw === '') {
            return null;
        }

        $raw = str_replace(["\0", "\r", "\n"], '', $raw);
        $raw = basename($raw);
        $raw = preg_replace('/[^A-Za-z0-9._ ()-]+/', '', $raw) ?? '';
        $raw = trim($raw);

        return $raw !== '' ? $raw : null;
    }
}
