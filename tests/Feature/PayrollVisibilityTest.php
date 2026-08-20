<?php

namespace Tests\Feature;

use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PayrollVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_regular_head_admin_payroll_run_is_filtered_to_own_project(): void
    {
        [$viewer, , $ownerProject, $ownProject, , ] = $this->seedData();
        $this->seedHistory($viewer, $ownerProject, $ownProject);

        $response = $this->actingAs($viewer)
            ->get('/payroll/run?project_id=' . $ownerProject->id)
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('HR/PayrollRun')
                ->has('projectOptions')
                ->has('generateProjectOptions'));

        $this->assertSame($ownProject->name, $response->inertiaProps('selectedProject')['name'] ?? null);

        $this->assertOptionNames(
            $response->inertiaProps('projectOptions'),
            ['Own Payroll Project'],
            ['Owner Secret Payroll Project', 'Legacy Payroll Project', 'Master Payroll Project']
        );

        $this->assertOptionNames(
            $response->inertiaProps('generateProjectOptions'),
            ['Own Payroll Project'],
            ['Owner Secret Payroll Project', 'Legacy Payroll Project', 'Master Payroll Project']
        );

        $this->assertProjectNames(
            $response->inertiaProps('payrollHistory'),
            ['Own Payroll Project'],
            ['Owner Secret Payroll Project', 'Legacy Payroll Project', 'Master Payroll Project']
        );
    }

    public function test_regular_head_admin_with_no_projects_sees_empty_payroll_run(): void
    {
        $this->seedData();
        $noProjectsAdmin = $this->makeUser('head_admin');

        $response = $this->actingAs($noProjectsAdmin)
            ->get('/payroll/run')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('HR/PayrollRun')
                ->has('projectOptions'));

        $this->assertNull($response->inertiaProps('selectedProject'));
        $this->assertEmpty($response->inertiaProps('projectOptions'));
        $this->assertEmpty($response->inertiaProps('generateProjectOptions'));
        $this->assertEmpty($response->inertiaProps('payrollRows'));
        $this->assertEmpty($response->inertiaProps('payrollHistory'));
    }

    public function test_special_head_admin_payroll_run_sees_legacy_and_master_projects(): void
    {
        [, $special, $ownerProject, $ownProject, $legacyProject, $masterProject] = $this->seedData();
        $this->seedHistory($special, $ownerProject, $ownProject, $legacyProject, $masterProject);

        $response = $this->actingAs($special)
            ->get('/payroll/run')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('HR/PayrollRun')
                ->has('projectOptions'));

        $selectedName = $response->inertiaProps('selectedProject')['name'] ?? null;
        $this->assertNotSame($ownerProject->name, $selectedName);

        $this->assertOptionNames(
            $response->inertiaProps('projectOptions'),
            ['Legacy Payroll Project', 'Master Payroll Project'],
            ['Owner Secret Payroll Project']
        );

        $this->assertProjectNames(
            $response->inertiaProps('payrollHistory'),
            ['Legacy Payroll Project', 'Master Payroll Project'],
            ['Owner Secret Payroll Project']
        );
    }

    private function assertOptionNames(array $options, array $expected, array $hidden): void
    {
        $names = collect($options)->pluck('name')->values();

        foreach ($expected as $name) {
            $this->assertTrue($names->contains($name), "Expected option '{$name}' to be present.");
        }

        foreach ($hidden as $name) {
            $this->assertFalse($names->contains($name), "Option '{$name}' should not be present.");
        }
    }

    private function assertProjectNames(array $historyRows, array $expected, array $hidden): void
    {
        $names = collect($historyRows)->pluck('project_name')->values();

        foreach ($expected as $name) {
            $this->assertTrue($names->contains($name), "Expected history project '{$name}' to be present.");
        }

        foreach ($hidden as $name) {
            $this->assertFalse($names->contains($name), "History project '{$name}' should not be present.");
        }
    }

    private function seedHistory(User $actor, Project $ownerProject, Project $ownProject, ?Project $legacyProject = null, ?Project $masterProject = null): void
    {
        $this->seedCutoff($actor, '2026-08-03', '2026-08-09', $ownerProject);
        $this->seedCutoff($actor, '2026-08-10', '2026-08-16', $ownProject);
        if ($legacyProject) {
            $this->seedCutoff($actor, '2026-07-27', '2026-08-02', $legacyProject);
        }
        if ($masterProject) {
            $this->seedCutoff($actor, '2026-07-20', '2026-07-26', $masterProject);
        }
    }

    private function seedCutoff(User $actor, string $start, string $end, Project $project): void
    {
        $cutoff = PayrollCutoff::create([
            'start_date' => $start,
            'end_date' => $end,
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);

        Payroll::create([
            'user_id' => $actor->id,
            'cutoff_id' => $cutoff->id,
            'project_id' => $project->id,
            'project_name' => $project->name,
            'project_client' => $project->client,
            'worker_name' => 'Worker ' . $project->id,
            'role' => 'Labor',
            'hours' => 40,
            'rate_per_hour' => 100,
            'gross' => 4000,
            'deductions' => 0,
            'net' => 4000,
            'status' => Payroll::STATUS_READY,
            'week_start' => $start,
        ]);
    }

    private function seedData(): array
    {
        $viewer = $this->makeUser('head_admin');
        $special = User::create([
            'fullname' => 'Head Admin',
            'email' => User::LEGACY_PROJECT_ACCESS_EMAIL,
            'password' => Hash::make('password'),
            'role' => 'head_admin',
        ]);
        $owner = $this->makeUser('head_admin');
        $master = $this->makeUser('master_admin');

        $legacyProject = $this->makeProject('Legacy Payroll Project', null);
        $ownerProject = $this->makeProject('Owner Secret Payroll Project', $owner->id);
        $ownProject = $this->makeProject('Own Payroll Project', $viewer->id);
        $masterProject = $this->makeProject('Master Payroll Project', $master->id);

        return [$viewer, $special, $ownerProject, $ownProject, $legacyProject, $masterProject];
    }

    private function makeProject(string $name, ?int $userId): Project
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
            'contract_amount' => 1000000,
            'user_id' => $userId,
        ]);
    }

    private function makeUser(string $role): User
    {
        return User::create([
            'fullname' => ucfirst(str_replace('_', ' ', $role)) . ' User',
            'email' => $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }
}