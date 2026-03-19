<?php

namespace App\Http\Controllers;

use App\Services\StorageProxyService;

class StorageProxyController extends Controller
{
    public function __construct(
        private readonly StorageProxyService $storageProxyService
    ) {
    }

    public function show(string $path)
    {
        return $this->storageProxyService->streamFile($path);
    }
}
