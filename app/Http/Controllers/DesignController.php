<?php

namespace App\Http\Controllers;

use App\Models\BuildProject;
use App\Models\DesignProject;
use App\Models\Expense;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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

        $payload = [
            'project_id' => $design->project_id,
            'design_contract_amount' => (float) $design->design_contract_amount,
            'downpayment' => (float) $design->downpayment,
            'total_received' => (float) $design->total_received,
            'office_payroll_deduction' => (float) $design->office_payroll_deduction,
            'design_progress' => (int) $design->design_progress,
            'client_approval_status' => $design->client_approval_status,
            'remaining' => (float) $design->design_contract_amount - (float) $design->total_received,
            'net_income' => (float) $design->total_received - (float) $design->office_payroll_deduction,
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
            'design_progress' => 'required|integer|min:0|max:100',
            'client_approval_status' => 'required|in:pending,approved,rejected',
        ]);

        $existing = DesignProject::where('project_id', $project)->first();
        $oldDownpayment = (float) ($existing?->downpayment ?? 0);
        $newDownpayment = (float) $validated['downpayment'];

        // If DP is received for the first time, enforce a minimum design progress baseline.
        if ($oldDownpayment <= 0 && $newDownpayment > 0) {
            $baseline = (int) config('fortress.design_dp_progress', 20);
            $baseline = max(0, min(100, $baseline));
            $validated['design_progress'] = max((int) $validated['design_progress'], $baseline);
        }

        DesignProject::updateOrCreate(
            ['project_id' => $project],
            $validated
        );

        $this->syncProjectFinancials($project);

        if ($validated['client_approval_status'] === 'approved') {
            $this->updateProjectPhaseToForBuild($project);
        }

        return redirect()
            ->route('design.show', ['project' => $project])
            ->with('success', 'Design tracker updated.');
    }

    private function updateProjectPhaseToForBuild(string $project): void
    {
        if (!Schema::hasTable('projects') || !Schema::hasColumn('projects', 'phase')) {
            return;
        }

        DB::table('projects')
            ->where('id', $project)
            ->update([
                'phase' => (string) config('fortress.project_phase_for_build', 'FOR_BUILD'),
            ]);
    }

    private function syncProjectFinancials(string $projectId): void
    {
        $design = DesignProject::where('project_id', $projectId)->first();
        $build = BuildProject::where('project_id', $projectId)->first();

        $designContractAmount = (float) ($design?->design_contract_amount ?? 0);
        $designTotalReceived = (float) ($design?->total_received ?? 0);

        $constructionContract = (float) ($build?->construction_contract ?? 0);
        $buildTotalClientPayment = (float) ($build?->total_client_payment ?? 0);
        $designProgress = (float) ($design?->design_progress ?? 0);

        $expenseConstructionCost = (float) Expense::where('project_id', $projectId)->sum('amount');
        $constructionCost = $expenseConstructionCost;
        $hasBuildData = $constructionContract > 0 || $buildTotalClientPayment > 0 || $constructionCost > 0;
        $buildProgress = $constructionContract > 0
            ? ($buildTotalClientPayment / $constructionContract) * 100
            : 0;
        $overallProgress = $hasBuildData
            ? (int) round(max(0, min(100, ($designProgress + $buildProgress) / 2)))
            : (int) round(max(0, min(100, $designProgress)));

        Project::whereKey($projectId)->update([
            'contract_amount' => $designContractAmount + $constructionContract,
            'design_fee' => $designContractAmount,
            'construction_cost' => $constructionCost,
            'total_client_payment' => $designTotalReceived + $buildTotalClientPayment,
            'overall_progress' => $overallProgress,
        ]);
    }
}
