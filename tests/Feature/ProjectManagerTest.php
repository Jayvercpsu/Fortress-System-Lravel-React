<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Project;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProjectManagerTest extends TestCase
{
    use RefreshDatabase;

    private User $projectManager;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->projectManager = $this->makeUser('project_manager');
        $this->foreman = $this->makeUser('foreman');

        $this->project = Project::create([
            'name' => 'PM Review Project',
            'client' => 'PM Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => $this->foreman->fullname,
            'status' => 'ACTIVE',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 25,
        ]);
    }

    public function test_project_manager_redirects_to_dashboard_after_login(): void
    {
        $response = $this->post('/login', [
            'email' => $this->projectManager->email,
            'password' => 'password',
        ]);

        $response->assertRedirect(route('project_manager.dashboard'));
    }

    public function test_project_manager_can_view_dashboard(): void
    {
        $this->actingAs($this->projectManager)
            ->get('/project-manager')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Dashboard')
                ->where('stats.total_projects', 1)
                ->has('recentSubmissions')
                ->has('lowProgressProjects'));
    }

    public function test_dashboard_shows_recent_submissions(): void
    {
        WeeklyAccomplishment::create([
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
            'scope_of_work' => 'Flooring',
            'percent_completed' => 50,
            'week_start' => now()->subWeek()->toDateString(),
            'is_placeholder' => false,
        ]);

        $this->actingAs($this->projectManager)
            ->get('/project-manager')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('recentSubmissions.0.scope_of_work', 'Flooring')
                ->where('recentSubmissions.0.percent_completed', 50));
    }

    public function test_dashboard_flags_low_progress_projects(): void
    {
        // Project was created with overall_progress = 25 in setUp, so it should appear.
        $this->actingAs($this->projectManager)
            ->get('/project-manager')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('lowProgressProjects.0.id', $this->project->id));
    }

    public function test_project_manager_can_view_attendance_read_only(): void
    {
        Attendance::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'worker_name' => 'Worker Juan',
            'worker_role' => 'Worker',
            'date' => now()->toDateString(),
            'hours' => 8,
            'attendance_code' => 'P',
        ]);

        $this->actingAs($this->projectManager)
            ->get('/project-manager/attendance')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Attendance')
                ->where('attendances.0.worker_name', 'Worker Juan'));
    }

    public function test_project_manager_can_view_payroll_read_only(): void
    {
        $this->actingAs($this->projectManager)
            ->get('/project-manager/payroll')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('ProjectManager/Payroll'));
    }

    public function test_project_manager_can_view_project_accomplishments(): void
    {
        $this->actingAs($this->projectManager)
            ->get("/project-manager/projects/{$this->project->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Project')
                ->where('project.id', $this->project->id)
                ->where('project.name', $this->project->name)
                ->has('projectStats')
                ->has('projectStats.total_accomplishments')
                ->has('projectStats.total_attendance_hours'));
    }

    public function test_project_manager_cannot_access_other_role_dashboards(): void
    {
        $this->actingAs($this->projectManager)->get('/head-admin')->assertForbidden();
        $this->actingAs($this->projectManager)->get('/hr')->assertForbidden();
        $this->actingAs($this->projectManager)->get('/foreman')->assertForbidden();
    }

    public function test_project_manager_cannot_mutate_payroll_or_attendance(): void
    {
        $payrollResponse = $this->actingAs($this->projectManager)
            ->post('/payroll', []);
        $payrollResponse->assertForbidden();

        $attendanceResponse = $this->actingAs($this->projectManager)
            ->post('/foreman/attendance', []);
        $attendanceResponse->assertForbidden();
    }

    public function test_other_roles_cannot_access_project_manager_pages(): void
    {
        $this->actingAs($this->foreman)->get('/project-manager')->assertForbidden();

        $hr = $this->makeUser('hr');
        $this->actingAs($hr)->get('/project-manager')->assertForbidden();
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
