<?php

namespace App\Repositories\Contracts;

use Symfony\Component\HttpFoundation\StreamedResponse;

interface StorageProxyRepositoryInterface
{
    public function fileExists(string $path): bool;

    public function streamResponse(string $path): StreamedResponse;

    public function downloadResponse(string $path, ?string $name = null): StreamedResponse;
}
