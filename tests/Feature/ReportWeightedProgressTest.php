<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * The Reports Weighted Progress, Progress, and Computed Amount columns
 * must always equal the /projects kanban card figures: strictly PM-based
 * progress (PmProgressService). Foreman plan numbers (project_scopes.
 * progress_percent, foreman accomplishment rows, stale overall_progress
 * column) must never leak into the report.
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
        $pm = User::create([
            'fullname' => 'Report PM',
            'email' => 'report.pm@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);
        $foreman = User::create([
            'fullname' => 'Report Foreman',
            'email' => 'report.foreman@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
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

        // Foreman plan sits at 100% with weights totalling above 100: the
        // old scope-based formula would report a clamped 100. It must not.
        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Heavy Scope A',
            'progress_percent' => 100,
            'status' => 'COMPLETED',
            'weight_percent' => 60,
            'contract_amount' => 600000,
        ]);
        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Heavy Scope B',
            'progress_percent' => 100,
            'status' => 'COMPLETED',
            'weight_percent' => 60,
            'contract_amount' => 400000,
        ]);
        WeeklyAccomplishment::create([
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'submitted_by' => $foreman->id,
            'scope_of_work' => 'Heavy Scope A',
            'percent_completed' => 100,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);

        // PM independently reports 50 and 25: 60*50/100 + 60*25/100 = 45.
        WeeklyAccomplishment::create([
            'project_id' => $project->id,
            'foreman_id' => null,
            'submitted_by' => $pm->id,
            'scope_of_work' => 'Heavy Scope A',
            'percent_completed' => 50,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);
        WeeklyAccomplishment::create([
            'project_id' => $project->id,
            'foreman_id' => null,
            'submitted_by' => $pm->id,
            'scope_of_work' => 'Heavy Scope B',
            'percent_completed' => 25,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);

        // A second project with foreman activity but no PM rows yet reads
        // 0 everywhere (the cards' 0/Pending rule).
        $pendingProject = Project::create([
            'name' => 'Report Pending Project',
            'client' => 'Report Client',
            'type' => 'Residential',
            'location' => 'QC',
            'status' => 'ONGOING',
            'phase' => 'Construction',
            'overall_progress' => 0,
            'user_id' => $headAdmin->id,
        ]);
        ProjectScope::create([
            'project_id' => $pendingProject->id,
            'scope_name' => 'Heavy Scope A',
            'progress_percent' => 100,
            'status' => 'COMPLETED',
            'weight_percent' => 100,
            'contract_amount' => 500000,
        ]);

        $this->actingAs($headAdmin)
            ->get('/reports')
            ->assertOk()
            ->assertInertia(function ($page) {
                $page->component('HeadAdmin/Reports/Index')
                    ->where('projectProfitability', function ($rows) {
                        $byName = collect($rows)->keyBy('name');

                        $weighted = $byName->get('Report Weighted Project');
                        $this->assertNotNull($weighted, 'Expected the weighted project row.');
                        $this->assertEquals(45, (float) ($weighted['weighted_progress_percent'] ?? -1));
                        $this->assertEquals(45, (float) ($weighted['overall_progress'] ?? -1));
                        // Earned amount reads the same PM percents
                        // (600000*50% + 400000*25% = 400000), not the
                        // foreman plan at 100% (1000000).
                        $this->assertEquals(400000, (float) ($weighted['computed_amount_to_date'] ?? -1));

                        $pending = $byName->get('Report Pending Project');
                        $this->assertNotNull($pending, 'Expected the pending project row.');
                        $this->assertEquals(0, (float) ($pending['weighted_progress_percent'] ?? -1));
                        $this->assertEquals(0, (float) ($pending['overall_progress'] ?? -1));
                        $this->assertEquals(0, (float) ($pending['computed_amount_to_date'] ?? -1));

                        return true;
                    });
            });

        // Same figures the /projects kanban cards report for these projects.
        $this->actingAs($headAdmin)
            ->get('/projects')
            ->assertOk()
            ->assertInertia(function ($page) {
                $page->component('HeadAdmin/Projects/Index')
                    ->where('projectBoard.columns', function ($columns) {
                        $cards = collect($columns)
                            ->flatMap(fn ($column) => $column['projects'] ?? [])
                            ->keyBy('name');

                        $weighted = $cards->get('Report Weighted Project');
                        $this->assertNotNull($weighted, 'Expected the weighted project card.');
                        $this->assertEquals(45, (float) ($weighted['overall_progress'] ?? -1));

                        $pending = $cards->get('Report Pending Project');
                        $this->assertNotNull($pending, 'Expected the pending project card.');
                        $this->assertEquals(0, (float) ($pending['overall_progress'] ?? -1));

                        return true;
                    });
            });
    }
}
