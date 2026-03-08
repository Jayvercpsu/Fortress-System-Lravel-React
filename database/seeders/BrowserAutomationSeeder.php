<?php

namespace Database\Seeders;

use App\Models\PayrollCutoff;
use App\Models\User;
use Illuminate\Database\Seeder;

class BrowserAutomationSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'headadmin@buildbooks.com'],
            [
                'fullname' => 'Head Administrator',
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
