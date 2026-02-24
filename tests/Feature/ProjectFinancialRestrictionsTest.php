<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProjectFinancialRestrictionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_cannot_hit_financials_endpoint(): void
    {
        $admin = $this->makeUser('admin');
        $project = $this->makeProject();

        $this->actingAs($admin)
            ->patch("/projects/{$project->id}/financials", [
                'contract_amount' => 100000,
                'design_fee' => 15000,
                'construction_cost' => 85000,
                'total_client_payment' => 25000,
            ])
            ->assertForbidden();
    }

    public function test_normal_project_update_rejects_financial_fields_server_side(): void
    {
        $admin = $this->makeUser('admin');
        $project = $this->makeProject();

        $response = $this->actingAs($admin)
            ->from("/projects/{$project->id}/edit")
            ->patch("/projects/{$project->id}", [
                'name' => 'Updated Project Name',
                'client' => 'Updated Client',
                'type' => 'Commercial',
                'location' => 'Manila',
                'assigned' => 'Admin User',
                'target' => '2026-03-01',
                'status' => 'ONGOING',
                'phase' => 'BUILD',
                'contract_amount' => 999999,
                'design_fee' => 111111,
                'construction_cost' => 222222,
                'total_client_payment' => 333333,
            ]);

        $response->assertRedirect("/projects/{$project->id}/edit");
        $response->assertSessionHasErrors([
            'contract_amount',
            'design_fee',
            'construction_cost',
            'total_client_payment',
        ]);

        $project->refresh();

        $this->assertSame('Visibility Project', $project->name);
        $this->assertSame(100000.0, (float) $project->contract_amount);
        $this->assertSame(10000.0, (float) $project->design_fee);
        $this->assertSame(80000.0, (float) $project->construction_cost);
        $this->assertSame(0.0, (float) $project->total_client_payment);
    }

    public function test_hr_can_update_financials_through_financials_endpoint(): void
    {
        $hr = $this->makeUser('hr');
        $project = $this->makeProject();

        $this->actingAs($hr)
            ->patch("/projects/{$project->id}/financials", [
                'contract_amount' => 120000,
                'design_fee' => 20000,
                'construction_cost' => 90000,
                'total_client_payment' => 45000,
            ])
            ->assertRedirect("/projects/{$project->id}");

        $project->refresh();

        $this->assertSame(120000.0, (float) $project->contract_amount);
        $this->assertSame(20000.0, (float) $project->design_fee);
        $this->assertSame(90000.0, (float) $project->construction_cost);
        $this->assertSame(45000.0, (float) $project->total_client_payment);
        $this->assertSame(75000.0, (float) $project->remaining_balance);
    }

    public function test_financials_page_refresh_does_not_overwrite_saved_financial_values(): void
    {
        $hr = $this->makeUser('hr');
        $project = $this->makeProject();

        $this->actingAs($hr)
            ->patch("/projects/{$project->id}/financials", [
                'contract_amount' => 100000,
                'design_fee' => 20000,
                'construction_cost' => 70000,
                'total_client_payment' => 40000,
            ])
            ->assertRedirect("/projects/{$project->id}");

        $this->actingAs($hr)
            ->get("/projects/{$project->id}/financials")
            ->assertOk();

        $project->refresh();

        $this->assertSame(100000.0, (float) $project->contract_amount);
        $this->assertSame(20000.0, (float) $project->design_fee);
        $this->assertSame(70000.0, (float) $project->construction_cost);
        $this->assertSame(40000.0, (float) $project->total_client_payment);
        $this->assertSame(60000.0, (float) $project->remaining_balance);
    }

    public function test_projects_kanban_shows_for_build_projects_stored_with_underscore_phase(): void
    {
        $admin = $this->makeUser('head_admin');

        Project::create([
            'name' => 'FOR BUILD Visibility Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'FOR_BUILD',
            'overall_progress' => 0,
            'contract_amount' => 100000,
            'design_fee' => 10000,
            'construction_cost' => 80000,
            'total_client_payment' => 0,
            'remaining_balance' => 100000,
        ]);

        $this->actingAs($admin)
            ->get('/projects')
            ->assertOk()
            ->assertSee('FOR BUILD Visibility Project');
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

    private function makeProject(): Project
    {
        return Project::create([
            'name' => 'Visibility Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
            'contract_amount' => 100000,
            'design_fee' => 10000,
            'construction_cost' => 80000,
            'total_client_payment' => 0,
            'remaining_balance' => 100000,
        ]);
    }
}
