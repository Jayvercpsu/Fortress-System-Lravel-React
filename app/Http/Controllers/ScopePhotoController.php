<?php

namespace App\Http\Controllers;

use App\Http\Requests\ScopePhotos\StoreScopePhotoRequest;
use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Services\ScopePhotoService;
use Illuminate\Http\Request;

class ScopePhotoController extends Controller
{
    public function __construct(
        private readonly ScopePhotoService $scopePhotoService
    ) {
    }

    public function store(StoreScopePhotoRequest $request, ProjectScope $scope)
    {
        $this->scopePhotoService->ensureAuthorized($request->user());
        $this->scopePhotoService->createScopePhoto(
            $scope,
            $request->file('photo'),
            $request->validated('caption')
        );

        return redirect()
            ->route('monitoring.show', ['project' => $scope->project_id])
            ->with('success', __('messages.scope_photos.created'));
    }

    public function destroy(Request $request, ScopePhoto $photo)
    {
        $this->scopePhotoService->ensureAuthorized($request->user());

        $projectId = $photo->scope?->project_id;
        $this->scopePhotoService->deleteScopePhoto($photo);

        return redirect()
            ->route('monitoring.show', ['project' => $projectId])
            ->with('success', __('messages.scope_photos.deleted'));
    }
}
