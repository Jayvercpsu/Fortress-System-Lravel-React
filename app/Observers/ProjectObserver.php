<?php

namespace App\Observers;

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
                'client_approval_status' => 'pending',
            ]
        );
    }

    public function updated(Project $project): void
    {
        if ($project->isDirty('phase') && $project->phase === (string) config('fortress.project_phase_for_build', 'FOR_BUILD')) {
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

        if ((int) $project->overall_progress >= 100 && $project->status !== (string) config('fortress.project_status_completed', 'COMPLETED')) {
            $project->status = (string) config('fortress.project_status_completed', 'COMPLETED');
            $project->saveQuietly();

            $recipients = User::whereIn('role', ['hr', 'head_admin'])->get();
            foreach ($recipients as $user) {
                $user->notify(new ProjectCompletedNotification($project));
            }
        }
    }
}
