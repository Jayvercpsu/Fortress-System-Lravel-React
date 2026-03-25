<?php

namespace App\Http\Controllers;

use App\Services\StorageProxyService;
use Illuminate\Http\Request;

class StorageProxyController extends Controller
{
    public function __construct(
        private readonly StorageProxyService $storageProxyService
    ) {
    }

    public function show(Request $request, string $path)
    {
        $forceDownload = $request->boolean('download');
        $downloadName = $request->query('name');

        return $this->storageProxyService->streamFile($path, $forceDownload, $downloadName);
    }
}
