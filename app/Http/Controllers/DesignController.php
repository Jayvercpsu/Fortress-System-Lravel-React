<?php

namespace App\Http\Controllers;

use App\Http\Requests\Designs\UpdateDesignRequest;
use App\Services\DesignService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DesignController extends Controller
{
    public function __construct(
        private readonly DesignService $designService
    ) {
    }

    public function show(Request $request, string $project)
    {
        $this->designService->ensureAuthorized($request->user());
        $page = $this->designService->pageByRole($request->user());

        return Inertia::render($page, [
            'projectId' => (string) $project,
            'design' => $this->designService->showPayload($project),
        ]);
    }

    public function update(UpdateDesignRequest $request, string $project)
    {
        $this->designService->ensureAuthorized($request->user());
        $this->designService->updateDesign($project, $request->validated());

        return redirect()
            ->route('design.show', ['project' => $project])
            ->with('success', __('messages.design.updated'));
    }
}
