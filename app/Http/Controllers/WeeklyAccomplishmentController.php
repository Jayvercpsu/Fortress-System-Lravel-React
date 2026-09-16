<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ScopePhoto;
use App\Services\ScopePhotoService;
use App\Services\WeeklyAccomplishmentService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WeeklyAccomplishmentController extends Controller
{
    public function __construct(
        private readonly WeeklyAccomplishmentService $weeklyAccomplishmentService,
        private readonly ScopePhotoService $scopePhotoService
    ) {
    }

    public function index(Request $request)
    {
        $this->weeklyAccomplishmentService->ensureAuthorized($request->user());
        $payload = $this->weeklyAccomplishmentService->indexPayload($request);

        return Inertia::render($payload['page'], $payload['props']);
    }

    public function show(Request $request, Project $project)
    {
        $this->weeklyAccomplishmentService->ensureAuthorized($request->user());
        $payload = $this->weeklyAccomplishmentService->detailPayload($request, $project);

        return Inertia::render($payload['page'], $payload['props']);
    }

    public function submissions(Request $request, Project $project)
    {
        return response()->json(
            $this->weeklyAccomplishmentService->detailSubmissions($request, $project)
        );
    }

    public function photos(Request $request, Project $project)
    {
        return response()->json(
            $this->weeklyAccomplishmentService->detailPhotos($request, $project)
        );
    }

    public function destroyScopePhoto(Request $request, ScopePhoto $scopePhoto)
    {
        $this->scopePhotoService->ensureAuthorized($request->user());
        $this->scopePhotoService->deleteScopePhoto($scopePhoto);

        return back()->with('success', 'Photo deleted.');
    }
}
