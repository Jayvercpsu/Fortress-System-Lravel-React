<?php

namespace Database\Seeders;

use App\Models\PayrollCutoff;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use Illuminate\Database\Seeder;

class BrowserAutomationSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'masteradmin@buildbooks.com'],
            [
                'fullname' => 'Master Administrator',
                'password' => 'password',
                'role' => 'master_admin',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'headadmin@buildbooks.com'],
            [
                'fullname' => 'Head Administrator',
                'password' => 'password',
                'role' => 'head_admin',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'headadmin2@buildbooks.com'],
            [
                'fullname' => 'Second Head Administrator',
                'password' => 'password',
                'role' => 'head_admin',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'admin@buildbooks.com'],
            [
                'fullname' => 'Fortress Demo Admin',
                'password' => 'password',
                'role' => 'admin',
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'hr@buildbooks.com'],
            [
                'fullname' => 'Fortress Demo HR',
                'password' => 'password',
                'role' => 'hr',
            ]
        );

        $this->call(FortressBuildingFlowSeeder::class);
        $this->seedHistoricalCutoffs();
        $this->seedClientPortalAccount();
    }

    private function seedClientPortalAccount(): void
    {
        $client = User::query()->updateOrCreate(
            ['username' => 'portal_client'],
            [
                'fullname' => 'Fortress Portal Client',
                'email' => 'portal.client@buildbooks.com',
                'password' => 'password',
                'role' => 'client',
            ]
        );

        // Assign the portal client to the active construction demo project so
        // /client/portal renders the progress receipt and exposes the logout toast.
        $constructionProject = Project::query()->find(4);
        if ($constructionProject) {
            ProjectAssignment::query()->updateOrCreate(
                ['project_id' => $constructionProject->id, 'user_id' => $client->id],
                ['role_in_project' => ProjectAssignment::ROLE_CLIENT]
            );
        }
    }

    private function seedHistoricalCutoffs(): void
    {
        $rows = [
            ['start_date' => '2026-01-05', 'end_date' => '2026-01-11', 'status' => 'generated'],
            ['start_date' => '2026-01-12', 'end_date' => '2026-01-18', 'status' => 'generated'],
            ['start_date' => '2026-01-19', 'end_date' => '2026-01-25', 'status' => 'generated'],
            ['start_date' => '2026-01-26', 'end_date' => '2026-02-01', 'status' => 'generated'],
            ['start_date' => '2026-02-02', 'end_date' => '2026-02-08', 'status' => 'generated'],
            ['start_date' => '2026-02-09', 'end_date' => '2026-02-15', 'status' => 'generated'],
            ['start_date' => '2026-02-16', 'end_date' => '2026-02-22', 'status' => 'generated'],
        ];

        foreach ($rows as $row) {
            PayrollCutoff::query()->firstOrCreate(
                [
                    'start_date' => $row['start_date'],
                    'end_date' => $row['end_date'],
                ],
                ['status' => $row['status']]
            );
        }
    }
}
