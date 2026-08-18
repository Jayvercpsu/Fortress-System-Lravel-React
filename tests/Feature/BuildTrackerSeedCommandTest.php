<?php

namespace Tests\Feature;

use App\Models\BuildProject;
use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\BuildRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BuildTrackerSeedCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_seeds_build_tracker_for_a_single_project(): void
    {
        $foreman = User::create([
            'fullname' => 'Seed Foreman',
            'email' => 'seed_foreman_'.uniqid().'@example.test',
            'password' => Hash::make('password'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = $this->makeProject('Seed Project', $foreman->fullname);
        $this->insertDefaultScopes($project);

        $this->artisan('fortress:seed-build-tracker', ['project' => $project->id])
            ->assertSuccessful();

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'construction_cost' => 830000.00,
            'total_client_payment' => 700000.00,
            'overall_progress' => 37,
        ]);

        $this->assertDatabaseHas('build_projects', [
            'project_id' => $project->id,
            'construction_contract' => 830000.00,
            'total_client_payment' => 700000.00,
        ]);

        $this->assertDatabaseHas('project_scopes', [
            'project_id' => $project->id,
            'scope_name' => 'Mobilization and Hauling',
            'contract_amount' => 33200.00,
            'weight_percent' => 4.00,
            'progress_percent' => 100,
            'status' => ProjectScope::STATUS_COMPLETED,
            'assigned_personnel' => $foreman->fullname,
        ]);

        // The 28 scope weights must always balance to exactly 100.00%.
        $totalWeight = (float) ProjectScope::query()
            ->where('project_id', $project->id)
            ->sum('weight_percent');

        $this->assertSame(100.0, round($totalWeight, 2));
        $this->assertSame(28, ProjectScope::query()->where('project_id', $project->id)->count());
    }

    public function test_command_seeds_all_construction_projects_when_no_id_given(): void
    {
        $projectA = $this->makeProject('All Seed A', null);
        $projectB = $this->makeProject('All Seed B', null);
        $designProject = $this->makeProject('Design Skip', null, Project::PHASE_DESIGN);
        $this->insertDefaultScopes($projectA);
        $this->insertDefaultScopes($projectB);

        $this->artisan('fortress:seed-build-tracker', [
            '--contract' => 1000000,
            '--payment' => 500000,
        ])->assertSuccessful();

        $this->assertDatabaseHas('build_projects', [
            'project_id' => $projectA->id,
            'construction_contract' => 1000000.00,
            'total_client_payment' => 500000.00,
        ]);
        $this->assertDatabaseHas('build_projects', [
            'project_id' => $projectB->id,
            'construction_contract' => 1000000.00,
            'total_client_payment' => 500000.00,
        ]);
        $this->assertDatabaseMissing('build_projects', ['project_id' => $designProject->id]);
    }

    public function test_command_resets_seeded_values(): void
    {
        $project = $this->makeProject('Reset Project', null);
        $this->insertDefaultScopes($project);

        $this->artisan('fortress:seed-build-tracker', ['project' => $project->id])
            ->assertSuccessful();

        $this->assertDatabaseHas('build_projects', [
            'project_id' => $project->id,
            'construction_contract' => 830000.00,
        ]);

        $this->artisan('fortress:seed-build-tracker', ['project' => $project->id, '--reset' => true])
            ->assertSuccessful();

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'construction_cost' => 0,
            'total_client_payment' => 0,
            'overall_progress' => 0,
        ]);
        $this->assertDatabaseHas('build_projects', [
            'project_id' => $project->id,
            'construction_contract' => 0,
            'total_client_payment' => 0,
        ]);
        $this->assertDatabaseHas('project_scopes', [
            'project_id' => $project->id,
            'scope_name' => 'Mobilization and Hauling',
            'contract_amount' => 0,
            'weight_percent' => 0,
            'progress_percent' => 0,
            'status' => ProjectScope::STATUS_NOT_STARTED,
        ]);
    }

    private function makeProject(string $name, ?string $assigned, string $phase = Project::PHASE_CONSTRUCTION): Project
    {
        return Project::create([
            'name' => $name,
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => $assigned,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => $phase,
            'overall_progress' => 0,
        ]);
    }

    private function insertDefaultScopes(Project $project): void
    {
        app(BuildRepository::class)->insertDefaultScopes($project, WeeklyAccomplishment::defaultScopeOfWorks());
    }
}
