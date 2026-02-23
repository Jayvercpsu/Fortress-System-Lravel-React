<?php

namespace App\Http\Controllers;

use App\Models\ProjectScope;
use Illuminate\Http\Request;

class ScopePhotoController extends Controller
{
    public function store(Request $request, ProjectScope $scope)
    {
        $this->authorizeRole($request);

        $validated = $request->validate([
            'photo' => ['required', 'image', 'max:10240'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $path = $validated['photo']->store('scope-photos/' . $scope->id, 'public');

        $scope->photos()->create([
            'photo_path' => $path,
            'caption' => $validated['caption'] ?? null,
        ]);

        return redirect()
            ->route('monitoring.show', ['project' => $scope->project_id])
            ->with('success', 'Scope photo uploaded.');
    }

    private function authorizeRole(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);
    }
}
