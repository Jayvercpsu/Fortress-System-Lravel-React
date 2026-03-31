<?php

namespace App\Http\Controllers;

use App\Http\Requests\Designs\UpdateDesignerTrackingRequest;
use App\Models\Project;
use App\Services\DashboardService;
use App\Services\DesignerDashboardService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DesignerDashboardController extends Controller
{
    public function __construct(
        private readonly DesignerDashboardService $designerDashboardService,
        private readonly DashboardService $dashboardService
    ) {
    }

    public function index(Request $request)
    {
        $this->designerDashboardService->ensureAuthorized($request->user());

        return $this->dashboardService->admin($request);
    }

    public function updateTracking(UpdateDesignerTrackingRequest $request, Project $project)
    {
        $this->designerDashboardService->ensureAuthorized($request->user());
        $this->designerDashboardService->updateTracking($project, $request->user(), $request->validated());

        return back()->with('success', 'Design tracking updated.');
    }
}
