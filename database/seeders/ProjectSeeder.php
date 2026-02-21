<?php

namespace Database\Seeders;

use App\Models\Project;
use Illuminate\Database\Seeder;

class ProjectSeeder extends Seeder
{
    public function run(): void
    {
        Project::firstOrCreate(
            ['name' => 'Sample Residential Build'],
            [
                'client' => 'Sample Client',
                'type' => 'Residential',
                'location' => 'Metro Manila',
                'assigned' => 'Team A',
                'target' => now()->addMonths(4)->toDateString(),
                'status' => 'PLANNING',
                'phase' => 'DESIGN',
                'overall_progress' => 0,
            ]
        );
    }
}
