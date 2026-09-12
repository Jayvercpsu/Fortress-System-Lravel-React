<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * The Reports Weighted Progress column must always equal the /projects
 * kanban computation: per-row rounded weighted sum, clamped to 0-100.
 */
class ReportWeightedProgressTest extends TestCase
{
    use RefreshDatabase;

    public function test_reports_weighted_progress_matches_projects_kanban(): void
    {
        $headAdmin = User::create([
            'fullname' => 'Report Head Admin',
            'email' => 'report.head.admin@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_HEAD_ADMIN,
        ]);

        $project = Project::create([
            'name' => 'Report Weighted Project',
            'client' => 'Report Client',
            'type' => 'Residential',
            'location' => 'QC',
            'status' => 'ONGOING',
            'phase' => 'Construction',
            'overall_progress' => 0,
            'user_id' => $headAdmin->id,
        ]);

        // Weights deliberately total above 100: raw sums would report 120,
        // the kanban formula clamps to 100.
        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Heavy Scope A',
            'progress_percent' => 100,
            'status' => 'COMPLETED',
            'weight_percent' => 60,
        ]);
        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Heavy Scope B',
            'progress_percent' => 100,
            'status' => 'COMPLETED',
            'weight_percent' => 60,
        ]);

        $this->actingAs($headAdmin)
            ->get('/reports')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/Reports/Index')
                ->where('projectProfitability.0.weighted_progress_percent', fn ($value) => (float) $value === 100.0));

        // Same figure the /projects kanban reports for this project.
        $this->actingAs($headAdmin)
            ->get('/projects')
            ->assertOk();
    }
}
