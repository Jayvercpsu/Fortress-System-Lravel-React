<?php

namespace App\Services;

use App\Models\User;
use App\Repositories\Contracts\DesignRepositoryInterface;
use App\Support\DesignComputation;

class DesignService
{
    public function __construct(
        private readonly DesignRepositoryInterface $designRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function showPayload(string $projectId): array
    {
        $design = $this->designRepository->firstOrCreateByProjectId($projectId);
        $project = $this->designRepository->findProjectById($projectId);

        $autoDesignProgress = DesignComputation::computeProgress(
            (float) $design->design_contract_amount,
            (float) $design->total_received,
            (string) $design->client_approval_status
        );

        if ((int) $design->design_progress !== $autoDesignProgress) {
            $design->design_progress = $autoDesignProgress;
            $design->save();
        }

        return [
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
            'project_status' => $project?->status ?? '',
            'project_phase' => $project?->phase ?? '',
        ];
    }

    public function updateDesign(string $projectId, array $validated): void
    {
        $validated['design_progress'] = DesignComputation::computeProgress(
            (float) $validated['design_contract_amount'],
            (float) $validated['total_received'],
            (string) $validated['client_approval_status']
        );

        $this->designRepository->updateOrCreateByProjectId($projectId, $validated);
        $this->syncProjectFinancials($projectId);
    }

    public function pageByRole(User $user): string
    {
        return $user->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Design/Show'
            : 'Admin/Design/Show';
    }

    private function syncProjectFinancials(string $projectId): void
    {
        // Financial fields are managed from Project Financials / Payments.
        // Tracker updates should not overwrite manual financial snapshots.
        return;
    }
}
