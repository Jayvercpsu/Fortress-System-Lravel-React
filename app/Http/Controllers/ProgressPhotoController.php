<?php

namespace App\Http\Controllers;

use App\Services\ProgressPhotoService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProgressPhotoController extends Controller
{
    public function __construct(
        private readonly ProgressPhotoService $progressPhotoService
    ) {
    }

    public function index(Request $request)
    {
        $this->progressPhotoService->ensureAuthorized($request->user());
        $payload = $this->progressPhotoService->indexPayload($request);

        return Inertia::render($payload['page'], $payload['props']);
    }
}
