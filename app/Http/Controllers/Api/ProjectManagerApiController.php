<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PayrollCutoff;
use App\Models\Project;
use App\Services\ProjectManagerService;
use Illuminate\Http\Request;

/**
 * Endpoints for the Project Manager mobile app.
 *
 * Every payload reuses the exact same service logic as the web Project
 * Manager pages: assigned projects only, independent PM accomplishment
 * rows (never Foreman JotForm records), and PM-based progress.
 */
class ProjectManagerApiController extends Controller
{
    public function __construct(
        private readonly ProjectManagerService $projectManagerService
    ) {
    }

    public function dashboard(Request $request)
    {
        $payload = $this->projectManagerService->dashboardPayload($request);

        return response()->json([
            'projects' => $payload['projects'],
            'stats' => $payload['stats'],
            'recent_submissions' => $payload['recentSubmissions'],
            'low_progress_projects' => $payload['lowProgressProjects'],
            'foremen' => $payload['foremen'],
        ]);
    }

    public function accomplishments(Request $request)
    {
        return response()->json(
            $this->projectManagerService->accomplishmentPayload($request)
        );
    }

    public function storeAccomplishments(Request $request)
    {
        $this->projectManagerService->storeAccomplishments($request);

        return response()->json([
            'message' => 'Accomplishment updated successfully.',
        ]);
    }

    public function destroyScopePhoto(Request $request, \App\Models\ScopePhoto $scopePhoto)
    {
        $this->projectManagerService->deleteScopePhoto($request, $scopePhoto);

        return response()->json([
            'message' => 'Photo deleted.',
        ]);
    }

    public function attendance(Request $request)
    {
        $payload = $this->projectManagerService->attendancePayload($request);

        return response()->json([
            'attendances' => $payload['attendances'],
            'projects' => $payload['projects'],
            'foremen' => $payload['foremen'],
            'table' => $payload['attendanceTable'],
        ]);
    }

    public function payroll(Request $request)
    {
        $payload = $this->projectManagerService->payrollPayload($request);

        $rows = collect($payload['payrolls'] ?? [])
            ->map(function ($payroll) {
                $cutoff = $payroll->cutoff;
                $start = $cutoff?->start_date?->toDateString();
                $end = $cutoff?->end_date?->toDateString();

                return [
                    'id' => $payroll->id,
                    'worker_name' => $payroll->worker_name,
                    'role' => $payroll->role,
                    'project_id' => $payroll->project_id !== null ? (int) $payroll->project_id : null,
                    'project_name' => $payroll->project?->name ?? $payroll->project_name,
                    'cutoff' => $cutoff ? [
                        'id' => $cutoff->id,
                        'start_date' => $start,
                        'end_date' => $end,
                        'status' => $cutoff->status,
                    ] : null,
                    'cutoff_start' => $start,
                    'cutoff_end' => $end,
                    'cutoff_label' => $start && $end ? $start.' — '.$end : null,
                    'hours' => (float) ($payroll->hours ?? 0),
                    'rate_per_hour' => (float) ($payroll->rate_per_hour ?? 0),
                    'gross' => (float) ($payroll->gross ?? 0),
                    'deductions' => (float) ($payroll->deductions ?? 0),
                    'net' => (float) ($payroll->net ?? 0),
                    'status' => $payroll->status,
                    'week_start' => $payroll->week_start?->toDateString(),
                ];
            })
            ->values();

        return response()->json([
            'payrolls' => $rows,
            'total_payable' => (float) ($payload['totalPayable'] ?? 0),
            'cutoffs' => PayrollCutoff::query()
                ->orderByDesc('start_date')
                ->orderByDesc('id')
                ->get(['id', 'start_date', 'end_date', 'status'])
                ->map(fn (PayrollCutoff $cutoff) => [
                    'id' => $cutoff->id,
                    'start_date' => $cutoff->start_date?->toDateString(),
                    'end_date' => $cutoff->end_date?->toDateString(),
                    'status' => $cutoff->status,
                ])
                ->values(),
            'table' => $payload['payrollTable'] ?? [],
        ]);
    }

    public function project(Request $request, Project $project)
    {
        return response()->json(
            $this->projectManagerService->projectPayload($request, $project)
        );
    }
}
