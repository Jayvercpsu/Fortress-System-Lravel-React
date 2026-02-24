<?php

namespace Tests\Feature;

use App\Models\DesignProject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DesignTrackerAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_and_admin_can_open_design_tracker_page(): void
    {
        $this->actingAs($this->makeUser('head_admin'))
            ->get('/projects/1/design')
            ->assertOk();

        $this->actingAs($this->makeUser('admin'))
            ->get('/projects/2/design')
            ->assertOk();
    }

    public function test_hr_and_foreman_cannot_open_design_tracker_page(): void
    {
        $this->actingAs($this->makeUser('hr'))
            ->get('/projects/1/design')
            ->assertForbidden();

        $this->actingAs($this->makeUser('foreman'))
            ->get('/projects/1/design')
            ->assertForbidden();
    }

    public function test_admin_can_update_design_tracker_record(): void
    {
        $this->actingAs($this->makeUser('admin'))
            ->patch('/projects/11/design', [
                'design_contract_amount' => 120000,
                'downpayment' => 25000,
                'total_received' => 80000,
                'office_payroll_deduction' => 10000,
                'client_approval_status' => 'approved',
            ])
            ->assertRedirect('/projects/11/design');

        $this->assertDatabaseHas('design_projects', [
            'project_id' => 11,
            'client_approval_status' => 'approved',
            'design_progress' => 100,
        ]);

        $design = DesignProject::where('project_id', 11)->firstOrFail();
        $this->assertSame(40000.0, (float) $design->design_contract_amount - (float) $design->total_received);
        $this->assertSame(70000.0, (float) $design->total_received - (float) $design->office_payroll_deduction);
    }

    public function test_hr_and_foreman_cannot_update_design_tracker_record(): void
    {
        $payload = [
            'design_contract_amount' => 100000,
            'downpayment' => 20000,
            'total_received' => 30000,
            'office_payroll_deduction' => 5000,
            'client_approval_status' => 'pending',
        ];

        $this->actingAs($this->makeUser('hr'))
            ->patch('/projects/5/design', $payload)
            ->assertForbidden();

        $this->actingAs($this->makeUser('foreman'))
            ->patch('/projects/5/design', $payload)
            ->assertForbidden();

        $this->assertDatabaseMissing('design_projects', ['project_id' => 5]);
    }

    public function test_pending_design_progress_is_computed_automatically_from_received_ratio(): void
    {
        DesignProject::create([
            'project_id' => 17,
            'design_contract_amount' => 100000,
            'downpayment' => 0,
            'total_received' => 10000,
            'office_payroll_deduction' => 1000,
            'design_progress' => 99,
            'client_approval_status' => 'pending',
        ]);

        $this->actingAs($this->makeUser('admin'))
            ->patch('/projects/17/design', [
                'design_contract_amount' => 100000,
                'downpayment' => 15000,
                'total_received' => 20000,
                'office_payroll_deduction' => 1000,
                'client_approval_status' => 'pending',
            ])
            ->assertRedirect('/projects/17/design');

        $this->assertDatabaseHas('design_projects', [
            'project_id' => 17,
            'design_progress' => 20,
        ]);
    }

    public function test_approved_design_progress_is_forced_to_100(): void
    {
        DesignProject::create([
            'project_id' => 18,
            'design_contract_amount' => 100000,
            'downpayment' => 0,
            'total_received' => 10000,
            'office_payroll_deduction' => 1000,
            'design_progress' => 10,
            'client_approval_status' => 'pending',
        ]);

        $this->actingAs($this->makeUser('admin'))
            ->patch('/projects/18/design', [
                'design_contract_amount' => 100000,
                'downpayment' => 25000,
                'total_received' => 30000,
                'office_payroll_deduction' => 2000,
                'client_approval_status' => 'approved',
            ])
            ->assertRedirect('/projects/18/design');

        $this->assertDatabaseHas('design_projects', [
            'project_id' => 18,
            'design_progress' => 100,
        ]);
    }

    public function test_zero_contract_amount_results_in_zero_pending_progress(): void
    {
        DesignProject::create([
            'project_id' => 19,
            'design_contract_amount' => 0,
            'downpayment' => 5000,
            'total_received' => 12000,
            'office_payroll_deduction' => 2000,
            'design_progress' => 35,
            'client_approval_status' => 'pending',
        ]);

        $this->actingAs($this->makeUser('admin'))
            ->patch('/projects/19/design', [
                'design_contract_amount' => 0,
                'downpayment' => 7000,
                'total_received' => 15000,
                'office_payroll_deduction' => 3000,
                'client_approval_status' => 'pending',
            ])
            ->assertRedirect('/projects/19/design');

        $this->assertDatabaseHas('design_projects', [
            'project_id' => 19,
            'design_progress' => 0,
        ]);
    }

    public function test_approved_design_updates_project_phase_to_for_build(): void
    {
        config(['fortress.project_phase_for_build' => 'FOR_BUILD']);

        \DB::table('projects')->insert([
            'id' => 30,
            'name' => 'Project 30',
            'client' => 'Client 30',
            'type' => '2Storey',
            'location' => 'Sample',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
            'contract_amount' => 0,
            'design_fee' => 0,
            'construction_cost' => 0,
            'total_client_payment' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->makeUser('admin'))
            ->patch('/projects/30/design', [
                'design_contract_amount' => 100000,
                'downpayment' => 10000,
                'total_received' => 10000,
                'office_payroll_deduction' => 500,
                'client_approval_status' => 'approved',
            ])
            ->assertRedirect('/projects/30/design');

        $this->assertDatabaseHas('projects', [
            'id' => 30,
            'phase' => 'FOR_BUILD',
        ]);
    }

    public function test_non_approved_design_does_not_change_project_phase(): void
    {
        \DB::table('projects')->insert([
            'id' => 31,
            'name' => 'Project 31',
            'client' => 'Client 31',
            'type' => '2Storey',
            'location' => 'Sample',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
            'contract_amount' => 0,
            'design_fee' => 0,
            'construction_cost' => 0,
            'total_client_payment' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->makeUser('admin'))
            ->patch('/projects/31/design', [
                'design_contract_amount' => 100000,
                'downpayment' => 10000,
                'total_received' => 10000,
                'office_payroll_deduction' => 500,
                'client_approval_status' => 'pending',
            ])
            ->assertRedirect('/projects/31/design');

        $this->assertDatabaseHas('projects', [
            'id' => 31,
            'phase' => 'DESIGN',
        ]);
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
