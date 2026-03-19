<?php

namespace App\Http\Controllers;

use App\Http\Requests\Builds\UpdateBuildTrackerRequest;
use App\Services\BuildService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BuildController extends Controller
{
    public function __construct(
        private readonly BuildService $buildService
    ) {
    }

    public function show(Request $request, string $project)
    {
        $this->buildService->ensureAuthorized($request->user());
        $page = $this->buildService->pageByRole($request->user());

        return Inertia::render($page, $this->buildService->showPayload($request, $project));
    }

    public function update(UpdateBuildTrackerRequest $request, string $project)
    {
        $this->buildService->ensureAuthorized($request->user());
        $this->buildService->updateBuild($project, $request->validated());

        return redirect()
            ->route('build.show', ['project' => $project])
            ->with('success', __('messages.build.updated'));
    }
}
