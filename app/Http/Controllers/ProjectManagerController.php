<?php

namespace App\Http\Controllers;

use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Models\Project;
use App\Services\ProjectManagerService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProjectManagerController extends Controller
{
    public function __construct(
        private readonly ProjectManagerService $projectManagerService,
        private readonly SettingsService $settingsService
    ) {
    }

    public function dashboard(Request $request)
    {
        return Inertia::render('ProjectManager/Dashboard', $this->projectManagerService->dashboardPayload($request));
    }

    public function attendance(Request $request)
    {
        return Inertia::render('ProjectManager/Attendance', $this->projectManagerService->attendancePayload($request));
    }

    public function payroll(Request $request)
    {
        return Inertia::render('ProjectManager/Payroll', $this->projectManagerService->payrollPayload($request));
    }

    public function project(Request $request, Project $project)
    {
        return Inertia::render('ProjectManager/Project', $this->projectManagerService->projectPayload($request, $project));
    }

    public function settings(Request $request)
    {
        return Inertia::render('ProjectManager/Settings', [
            'account' => $this->settingsService->getSettingsPayload($request->user()),
        ]);
    }

    public function updateSettings(UpdateSettingsRequest $request)
    {
        $this->settingsService->updateSettings($request->user(), $request->validated());

        return redirect()->route('project_manager.settings');
    }
}
