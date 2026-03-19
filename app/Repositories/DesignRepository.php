<?php

namespace App\Repositories;

use App\Models\DesignProject;
use App\Models\Project;
use App\Repositories\Contracts\DesignRepositoryInterface;

class DesignRepository implements DesignRepositoryInterface
{
    public function firstOrCreateByProjectId(string $projectId): DesignProject
    {
        return DesignProject::query()->firstOrCreate(
            ['project_id' => $projectId],
            [
                'design_contract_amount' => 0,
                'downpayment' => 0,
                'total_received' => 0,
                'office_payroll_deduction' => 0,
                'design_progress' => 0,
                'client_approval_status' => DesignProject::CLIENT_APPROVAL_PENDING,
            ]
        );
    }

    public function updateOrCreateByProjectId(string $projectId, array $attributes): void
    {
        DesignProject::query()->updateOrCreate(
            ['project_id' => $projectId],
            $attributes
        );
    }

    public function findProjectById(string $projectId): ?Project
    {
        return Project::query()->find($projectId);
    }
}
