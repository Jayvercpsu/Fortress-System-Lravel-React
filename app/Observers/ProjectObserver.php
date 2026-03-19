<?php

namespace App\Observers;

use App\Enums\ProjectStatus;
use App\Models\BuildProject;
use App\Models\DesignProject;
use App\Models\Project;
use App\Models\User;
use App\Notifications\ProjectCompletedNotification;

class ProjectObserver
{
    public function created(Project $project): void
    {
        DesignProject::firstOrCreate(
            ['project_id' => $project->id],
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

    public function updated(Project $project): void
    {
        if ($project->wasChanged('phase') && $project->phase === (string) config('fortress.project_phase_for_build', 'FOR_BUILD')) {
            BuildProject::firstOrCreate(
                ['project_id' => $project->id],
                [
                    'construction_contract' => 0,
                    'total_client_payment' => 0,
                    'materials_cost' => 0,
                    'labor_cost' => 0,
                    'equipment_cost' => 0,
                ]
            );
        }

        if (
            $project->wasChanged('overall_progress')
            && (int) $project->overall_progress >= 100
            && $project->status !== (string) config('fortress.project_status_completed', ProjectStatus::COMPLETED->value)
        ) {
            $project->status = (string) config('fortress.project_status_completed', ProjectStatus::COMPLETED->value);
            $project->saveQuietly();

            $recipients = User::whereIn('role', [User::ROLE_HR, User::ROLE_HEAD_ADMIN])->get();
            foreach ($recipients as $user) {
                $user->notify(new ProjectCompletedNotification($project));
            }
        }
    }
}
