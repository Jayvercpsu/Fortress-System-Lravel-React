<?php

namespace App\Http\Controllers;

use App\Support\Uploads\UploadManager;
use Illuminate\Support\Facades\Storage;

class StorageProxyController extends Controller
{
    public function show(string $path)
    {
        $normalizedPath = ltrim($path, '/');
        if ($normalizedPath === '' || str_contains($normalizedPath, '..')) {
            abort(404);
        }

        $disk = UploadManager::disk();
        if (!Storage::disk($disk)->exists($normalizedPath)) {
            abort(404);
        }

        return Storage::disk($disk)->response($normalizedPath);
    }
}

