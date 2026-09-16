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

        $caption = $request->validated('caption');

        // Upload destination chosen on the build page: 'pm' files to the PM
        // side only, 'foreman' to the foreman side only (visible on the
        // jotform + foreman mobile). Force-picks win over the legacy flag.
        $side = trim((string) ($request->validated('photo_side') ?? ''));
        if ($side === '' && trim((string) ($request->validated('as_pm') ?? '')) === 'pm') {
            $side = 'pm';
        }

        if (in_array($side, ['pm', 'foreman'], true)) {
            $weekStart = \Illuminate\Support\Carbon::now('Asia/Manila')
                ->startOfWeek(\Illuminate\Support\Carbon::MONDAY)
                ->toDateString();
            $tag = $side === 'pm' ? '[PM Weekly]' : '[Jotform Weekly]';
            $caption = $tag . ' | Week: ' . $weekStart . ' | Scope: ' . trim((string) $scope->scope_name)
                . (trim((string) ($caption ?? '')) !== '' ? ' | ' . trim((string) $caption) : '');
        }

        $this->scopePhotoService->createScopePhoto(
            $scope,
            $request->file('photo'),
            $caption,
            (int) $request->user()->id,
            (string) $request->user()->role
        );

        return $this->boardRedirect($request, (int) $scope->project_id)
            ->with('success', __('messages.scope_photos.created'));
    }

    public function destroy(Request $request, ScopePhoto $photo)
    {
        $this->scopePhotoService->ensureAuthorized($request->user());

        $projectId = (int) ($photo->scope?->project_id ?? 0);
        $this->scopePhotoService->deleteScopePhoto($photo);

        return $this->boardRedirect($request, $projectId)
            ->with('success', __('messages.scope_photos.deleted'));
    }

    /**
     * Stay on the build tracker when the request came from there;
     * otherwise fall back to the monitoring page.
     */
    private function boardRedirect(Request $request, int $projectId)
    {
        if (str_contains((string) $request->headers->get('referer'), '/build')) {
            return redirect()->route('build.show', ['project' => $projectId]);
        }

        return redirect()->route('monitoring.show', ['project' => $projectId]);
    }
}
