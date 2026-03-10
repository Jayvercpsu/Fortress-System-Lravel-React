<?php

namespace Tests\Feature;

use App\Models\DesignProject;
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
            'phase' => 'Design',
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
            'phase' => 'Design',
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

    public function test_admin_can_transfer_approved_design_project_to_construction(): void
    {
        $admin = $this->makeUser('admin');

        $project = Project::create([
            'name' => 'Design Transfer Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'City',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'Design',
            'overall_progress' => 0,
        ]);

        DesignProject::query()
            ->where('project_id', $project->id)
            ->update([
                'design_contract_amount' => 100000,
                'total_received' => 100000,
                'design_progress' => 100,
                'client_approval_status' => 'approved',
            ]);

        $this->actingAs($admin)
            ->patch("/projects/{$project->id}/transfer-to-construction")
            ->assertRedirect('/projects');

        $duplicate = Project::query()->where('source_project_id', $project->id)->first();

        $this->assertNotNull($duplicate, 'Expected a construction duplicate to be created.');
        $this->assertSame('Construction', $duplicate->phase);
        $this->assertDatabaseHas('build_projects', ['project_id' => $duplicate->id]);
    }

    public function test_design_transfer_to_construction_requires_approved_status(): void
    {
        $admin = $this->makeUser('admin');

        $project = Project::create([
            'name' => 'Pending Design Transfer',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'City',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'Design',
            'overall_progress' => 0,
        ]);

        DesignProject::query()
            ->where('project_id', $project->id)
            ->update(['client_approval_status' => 'pending']);

        $this->actingAs($admin)
            ->from('/projects')
            ->patch("/projects/{$project->id}/transfer-to-construction")
            ->assertRedirect('/projects');

        $this->assertDatabaseMissing('projects', ['source_project_id' => $project->id]);
    }

    public function test_admin_can_transfer_construction_project_to_completed(): void
    {
        $admin = $this->makeUser('admin');

        $project = Project::create([
            'name' => 'Construction Transfer Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'City',
            'assigned' => null,
            'target' => null,
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 12,
        ]);

        $this->actingAs($admin)
            ->patch("/projects/{$project->id}/transfer-to-completed")
            ->assertRedirect('/projects');

        $project->refresh();

        $this->assertSame('Completed', $project->phase);
        $this->assertSame('COMPLETED', $project->status);
        $this->assertSame(100, (int) $project->overall_progress);
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
