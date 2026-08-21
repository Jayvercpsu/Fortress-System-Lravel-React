<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class KpiVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_regular_head_admin_kpi_projects_and_data_are_filtered(): void
    {
        [$viewer, , $ownerProject, $ownProject, $legacyProject, $masterProject] = $this->seedData();

        $response = $this->actingAs($viewer)
            ->get('/kpi')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('HeadAdmin/Kpi')
                ->has('projects')
                ->has('workerKpis'));

        $this->assertProjectNames(
            $response->inertiaProps('projects'),
            ['Own KPI Project'],
            ['Owner Secret KPI Project', 'Legacy KPI Project', 'Master KPI Project']
        );

        $this->assertWorkerNames(
            $response->inertiaProps('workerKpis'),
            ['Own KPI Worker'],
            ['Owner KPI Worker', 'Legacy KPI Worker', 'Master KPI Worker']
        );
    }

    public function test_special_head_admin_kpi_includes_legacy_and_master_projects(): void
    {
        [, $special, $ownerProject, , $legacyProject, $masterProject] = $this->seedData();

        $response = $this->actingAs($special)
            ->get('/kpi')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('HeadAdmin/Kpi')
                ->has('projects')
                ->has('workerKpis'));

        $this->assertProjectNames(
            $response->inertiaProps('projects'),
            ['Legacy KPI Project', 'Master KPI Project'],
            ['Owner Secret KPI Project']
        );

        $this->assertWorkerNames(
            $response->inertiaProps('workerKpis'),
            ['Legacy KPI Worker', 'Master KPI Worker'],
            ['Owner KPI Worker']
        );
    }

    public function test_admin_kpi_sees_all_projects_and_data(): void
    {
        $this->seedData();
        $admin = $this->makeUser('admin');

        $response = $this->actingAs($admin)
            ->get('/kpi')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Kpi')
                ->has('projects')
                ->has('workerKpis'));

        $this->assertProjectNames(
            $response->inertiaProps('projects'),
            ['Own KPI Project', 'Owner Secret KPI Project', 'Legacy KPI Project', 'Master KPI Project'],
            []
        );

        $this->assertWorkerNames(
            $response->inertiaProps('workerKpis'),
            ['Own KPI Worker', 'Owner KPI Worker', 'Legacy KPI Worker', 'Master KPI Worker'],
            []
        );
    }

    private function assertProjectNames(array $projects, array $expected, array $hidden): void
    {
        $names = collect($projects)->pluck('name')->values();

        foreach ($expected as $name) {
            $this->assertTrue($names->contains($name), "Expected project '{$name}' to be present.");
        }

        foreach ($hidden as $name) {
            $this->assertFalse($names->contains($name), "Project '{$name}' should not be present.");
        }
    }

    private function assertWorkerNames(array $workerKpis, array $expected, array $hidden): void
    {
        $names = collect($workerKpis)->pluck('worker_name')->values();

        foreach ($expected as $name) {
            $this->assertTrue($names->contains($name), "Expected worker '{$name}' to be present.");
        }

        foreach ($hidden as $name) {
            $this->assertFalse($names->contains($name), "Worker '{$name}' should not be present.");
        }
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
        $foreman = $this->makeUser('foreman');

        $legacyProject = $this->makeProject('Legacy KPI Project', null);
        $ownerProject = $this->makeProject('Owner Secret KPI Project', $owner->id);
        $ownProject = $this->makeProject('Own KPI Project', $viewer->id);
        $masterProject = $this->makeProject('Master KPI Project', $master->id);

        $this->seedAttendance($foreman, 'Own KPI Worker', $ownProject);
        $this->seedAttendance($foreman, 'Owner KPI Worker', $ownerProject);
        $this->seedAttendance($foreman, 'Legacy KPI Worker', $legacyProject);
        $this->seedAttendance($foreman, 'Master KPI Worker', $masterProject);

        return [$viewer, $special, $ownerProject, $ownProject, $legacyProject, $masterProject];
    }

    private function seedAttendance(User $foreman, string $workerName, Project $project): void
    {
        Attendance::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'worker_name' => $workerName,
            'worker_role' => 'Worker',
            'date' => '2026-08-18',
            'hours' => 8,
            'attendance_code' => 'P',
        ]);
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