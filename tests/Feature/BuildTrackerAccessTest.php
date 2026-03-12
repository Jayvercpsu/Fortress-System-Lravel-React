<?php

namespace Tests\Feature;

use App\Models\BuildProject;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BuildTrackerAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_and_admin_can_open_build_tracker_page(): void
    {
        $projectOne = $this->makeProject('Build Project One');
        $projectTwo = $this->makeProject('Build Project Two');

        $this->actingAs($this->makeUser('head_admin'))
            ->get("/projects/{$projectOne->id}/build")
            ->assertOk();

        $this->actingAs($this->makeUser('admin'))
            ->get("/projects/{$projectTwo->id}/build")
            ->assertOk();
    }

    public function test_hr_and_foreman_cannot_open_build_tracker_page(): void
    {
        $project = $this->makeProject('Build Restricted Project');

        $this->actingAs($this->makeUser('hr'))
            ->get("/projects/{$project->id}/build")
            ->assertForbidden();

        $this->actingAs($this->makeUser('foreman'))
            ->get("/projects/{$project->id}/build")
            ->assertForbidden();
    }

    public function test_admin_can_update_build_tracker_record(): void
    {
        $project = $this->makeProject('Build Update Project');

        $this->actingAs($this->makeUser('admin'))
            ->patch("/projects/{$project->id}/build", [
                'construction_contract' => 1000000,
                'total_client_payment' => 300000,
                'materials_cost' => 120000,
                'labor_cost' => 80000,
                'equipment_cost' => 50000,
            ])
            ->assertRedirect("/projects/{$project->id}/build");

        $this->assertDatabaseHas('build_projects', [
            'project_id' => $project->id,
            'construction_contract' => 1000000,
            'total_client_payment' => 300000,
            'materials_cost' => 120000,
            'labor_cost' => 80000,
            'equipment_cost' => 50000,
        ]);

        $build = BuildProject::where('project_id', $project->id)->firstOrFail();
        $totalExpenses = (float) $build->materials_cost + (float) $build->labor_cost + (float) $build->equipment_cost;
        $paymentProgress = (float) $build->total_client_payment / (float) $build->construction_contract * 100;

        $this->assertSame(250000.0, $totalExpenses);
        $this->assertSame(30.0, $paymentProgress);
    }

    public function test_hr_and_foreman_cannot_update_build_tracker_record(): void
    {
        $project = $this->makeProject('Build Forbidden Update Project');

        $payload = [
            'construction_contract' => 500000,
            'total_client_payment' => 200000,
            'materials_cost' => 100000,
            'labor_cost' => 50000,
            'equipment_cost' => 25000,
        ];

        $this->actingAs($this->makeUser('hr'))
            ->patch("/projects/{$project->id}/build", $payload)
            ->assertForbidden();

        $this->actingAs($this->makeUser('foreman'))
            ->patch("/projects/{$project->id}/build", $payload)
            ->assertForbidden();

        $this->assertDatabaseMissing('build_projects', ['project_id' => $project->id]);
    }

    private function makeUser(string $role): User
    {
        return User::create([
            'fullname' => ucfirst($role) . ' User',
            'email' => $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }

    private function makeProject(string $name): Project
    {
        return Project::create([
            'name' => $name,
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'Construction',
            'overall_progress' => 0,
        ]);
    }
}
