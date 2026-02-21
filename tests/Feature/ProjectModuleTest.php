<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProjectModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_can_create_and_edit_project(): void
    {
        $headAdmin = $this->makeUser('head_admin');

        $this->actingAs($headAdmin)->get('/projects')->assertOk();
        $this->actingAs($headAdmin)->get('/projects/create')->assertOk();

        $this->actingAs($headAdmin)->post('/projects', [
            'name' => 'Project A',
            'client' => 'Client A',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => 'Team 1',
            'target' => '2026-12-31',
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
        ])->assertRedirect();

        $project = Project::where('name', 'Project A')->firstOrFail();

        $this->actingAs($headAdmin)->get("/projects/{$project->id}")->assertOk();
        $this->actingAs($headAdmin)->get("/projects/{$project->id}/edit")->assertOk();

        $this->actingAs($headAdmin)->patch("/projects/{$project->id}", [
            'name' => 'Project A Updated',
            'client' => 'Client A',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => 'Team 1',
            'target' => '2026-12-31',
            'status' => 'ACTIVE',
            'phase' => 'DESIGN',
            'overall_progress' => 10,
        ])->assertRedirect("/projects/{$project->id}");

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'name' => 'Project A Updated',
            'status' => 'ACTIVE',
        ]);
    }

    public function test_admin_can_view_projects_but_cannot_access_create_or_edit_page(): void
    {
        $project = Project::create([
            'name' => 'P1',
            'client' => 'C1',
            'type' => 'Residential',
            'location' => 'City',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
        ]);

        $admin = $this->makeUser('admin');
        $this->actingAs($admin)->get('/projects')->assertOk();
        $this->actingAs($admin)->get("/projects/{$project->id}")->assertOk();
        $this->actingAs($admin)->get('/projects/create')->assertForbidden();
        $this->actingAs($admin)->get("/projects/{$project->id}/edit")->assertForbidden();
    }

    public function test_financial_endpoint_allows_head_admin_and_hr_only(): void
    {
        $project = Project::create([
            'name' => 'P2',
            'client' => 'C2',
            'type' => 'Commercial',
            'location' => 'City',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
        ]);

        $payload = [
            'contract_amount' => 1000000,
            'design_fee' => 100000,
            'construction_cost' => 700000,
            'total_client_payment' => 200000,
        ];

        $this->actingAs($this->makeUser('head_admin'))
            ->patch("/projects/{$project->id}/financials", $payload)
            ->assertRedirect("/projects/{$project->id}");

        $this->actingAs($this->makeUser('hr'))
            ->patch("/projects/{$project->id}/financials", [
                ...$payload,
                'total_client_payment' => 300000,
            ])
            ->assertRedirect("/projects/{$project->id}");

        $this->actingAs($this->makeUser('admin'))
            ->patch("/projects/{$project->id}/financials", $payload)
            ->assertForbidden();

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'total_client_payment' => 300000,
        ]);
    }

    public function test_project_observer_creates_design_and_build_and_completes_status(): void
    {
        $head = $this->makeUser('head_admin');
        $hr = $this->makeUser('hr');

        $project = Project::create([
            'name' => 'Observer Project',
            'client' => 'Client X',
            'type' => 'Residential',
            'location' => 'City',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
        ]);

        $this->assertDatabaseHas('design_projects', ['project_id' => $project->id]);

        $project->update(['phase' => 'FOR_BUILD']);
        $this->assertDatabaseHas('build_projects', ['project_id' => $project->id]);

        $project->update(['overall_progress' => 100]);
        $project->refresh();

        $this->assertSame('COMPLETED', $project->status);
        $this->assertGreaterThan(0, $head->notifications()->count());
        $this->assertGreaterThan(0, $hr->notifications()->count());
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
}
