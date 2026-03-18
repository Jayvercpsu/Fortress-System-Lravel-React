<?php

namespace App\Http\Controllers;

use App\Models\DesignProject;
use App\Models\Project;
use App\Support\DesignComputation;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DesignController extends Controller
{
    public function show(Request $request, string $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $design = DesignProject::firstOrCreate(
            ['project_id' => $project],
            [
                'design_contract_amount' => 0,
                'downpayment' => 0,
                'total_received' => 0,
                'office_payroll_deduction' => 0,
                'design_progress' => 0,
                'client_approval_status' => 'pending',
            ]
        );
        $projectModel = Project::find($project);

        $autoDesignProgress = DesignComputation::computeProgress(
            (float) $design->design_contract_amount,
            (float) $design->total_received,
            (string) $design->client_approval_status
        );

        if ((int) $design->design_progress !== $autoDesignProgress) {
            $design->design_progress = $autoDesignProgress;
            $design->save();
        }

        $payload = [
            'project_id' => $design->project_id,
            'design_contract_amount' => (float) $design->design_contract_amount,
            'downpayment' => (float) $design->downpayment,
            'total_received' => (float) $design->total_received,
            'office_payroll_deduction' => (float) $design->office_payroll_deduction,
            'design_progress' => $autoDesignProgress,
            'client_approval_status' => $design->client_approval_status,
            'collection_progress_pct' => DesignComputation::computeCollectionPercent(
                (float) $design->design_contract_amount,
                (float) $design->total_received
            ),
            'computation_basis' => DesignComputation::milestoneBreakdown((float) $design->design_contract_amount),
            'computation_basis_total_percent' => DesignComputation::totalBasisPercent(),
            'remaining' => (float) $design->design_contract_amount - (float) $design->total_received,
            'net_income' => (float) $design->total_received - (float) $design->office_payroll_deduction,
            'project_status' => $projectModel?->status ?? '',
            'project_phase' => $projectModel?->phase ?? '',
        ];

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Design/Show'
            : 'Admin/Design/Show';

        return Inertia::render($page, [
            'projectId' => (string) $project,
            'design' => $payload,
        ]);
    }

    public function update(Request $request, string $project)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $validated = $request->validate([
            'design_contract_amount' => 'required|numeric|min:0',
            'downpayment' => 'required|numeric|min:0',
            'total_received' => 'required|numeric|min:0',
            'office_payroll_deduction' => 'required|numeric|min:0',
            'client_approval_status' => 'required|in:pending,approved,rejected',
        ]);
        $validated['design_progress'] = DesignComputation::computeProgress(
            (float) $validated['design_contract_amount'],
            (float) $validated['total_received'],
            (string) $validated['client_approval_status']
        );

        DesignProject::updateOrCreate(
            ['project_id' => $project],
            $validated
        );

        $this->syncProjectFinancials($project);

        return redirect()
            ->route('design.show', ['project' => $project])
            ->with('success', 'Design tracker updated successfully.');
    }

    private function syncProjectFinancials(string $projectId): void
    {
        // Financial fields are managed from Project Financials / Payments.
        // Tracker updates should not overwrite manual financial snapshots.
        return;
    }

}
