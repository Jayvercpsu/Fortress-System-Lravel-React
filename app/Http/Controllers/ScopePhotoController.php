<?php

namespace App\Http\Controllers;

use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\Request;

class ScopePhotoController extends Controller
{
    public function store(Request $request, ProjectScope $scope)
    {
        $this->authorizeRole($request);

        $validated = $request->validate([
            'photo' => ['required', 'image', UploadManager::maxRule()],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $path = UploadManager::store($validated['photo'], 'scope-photos/' . $scope->id);

        $scope->photos()->create([
            'photo_path' => $path,
            'caption' => $validated['caption'] ?? null,
        ]);

        return redirect()
            ->route('monitoring.show', ['project' => $scope->project_id])
            ->with('success', 'Scope photo uploaded successfully.');
    }

    public function destroy(Request $request, ScopePhoto $photo)
    {
        $this->authorizeRole($request);

        $projectId = $photo->scope?->project_id;
        UploadManager::delete($photo->photo_path);
        $photo->delete();

        return redirect()
            ->route('monitoring.show', ['project' => $projectId])
            ->with('success', 'Scope photo deleted successfully.');
    }

    private function authorizeRole(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);
    }
}
