<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Payroll;
use App\Models\PayrollCutoff;
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
            'phase' => 'Construction',
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
                ->where('stats.low_progress_projects', 1)
                ->has('recentSubmissions')
                ->has('lowProgressProjects'));
    }

    public function test_total_projects_counts_only_construction_phase(): void
    {
        // Create a Design project — it should NOT be counted in total_projects.
        Project::create([
            'name' => 'Design Only Project',
            'client' => 'Design Client',
            'type' => 'Residential',
            'location' => 'Makati',
            'assigned' => $this->foreman->fullname,
            'status' => 'ACTIVE',
            'phase' => 'Design',
            'overall_progress' => 50,
        ]);

        $this->actingAs($this->projectManager)
            ->get('/project-manager')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                // total_projects should be 1 (only the Construction project from setUp), not 2.
                ->where('stats.total_projects', 1)
                // The Design project should not appear in the projects list.
                ->where('projects', fn ($projects) => $projects->every('phase', 'Construction')));
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

    public function test_project_manager_payroll_cutoff_range_filter_returns_matching_records(): void
    {
        $inRange = PayrollCutoff::create([
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-15',
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);
        $outside = PayrollCutoff::create([
            'start_date' => '2026-04-01',
            'end_date' => '2026-04-15',
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);

        $this->payrollForCutoff($inRange->id, 'Juan Dela Cruz');
        $this->payrollForCutoff($outside->id, 'Maria Santos');

        $this->actingAs($this->projectManager)
            ->get('/project-manager/payroll?cutoff_start=2026-07-01&cutoff_end=2026-07-20')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Payroll')
                ->where('payrollTable.cutoff_start', '2026-07-01')
                ->where('payrollTable.cutoff_end', '2026-07-20')
                ->has('payrolls', 1)
                ->where('payrolls.0.worker_name', 'Juan Dela Cruz')
                ->has('payrolls.0.cutoff')
                ->missing('payrolls.1'));
    }

    public function test_project_manager_payroll_cutoff_start_only_filters_by_containment(): void
    {
        $inRange = PayrollCutoff::create([
            'start_date' => '2026-06-25',
            'end_date' => '2026-07-05',
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);
        $startsBefore = PayrollCutoff::create([
            'start_date' => '2026-06-20',
            'end_date' => '2026-07-05',
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);
        $before = PayrollCutoff::create([
            'start_date' => '2026-05-01',
            'end_date' => '2026-05-15',
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);

        $this->payrollForCutoff($inRange->id, 'In Range Worker');
        $this->payrollForCutoff($startsBefore->id, 'Starts Before Worker');
        $this->payrollForCutoff($before->id, 'Old Worker');

        // Only cutoff_start supplied — keep cutoffs whose start_date is on/after it.
        $this->actingAs($this->projectManager)
            ->get('/project-manager/payroll?cutoff_start=2026-06-25')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Payroll')
                ->where('payrollTable.cutoff_start', '2026-06-25')
                ->where('payrollTable.cutoff_end', '')
                ->has('payrolls', 1)
                ->where('payrolls.0.worker_name', 'In Range Worker'));
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

    public function test_project_page_renders_with_attendance_records(): void
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
            ->get("/project-manager/projects/{$this->project->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Project')
                ->where('attendanceSummary.0.worker_name', 'Worker Juan')
                ->where('attendanceSummary.0.days_logged', 1)
                ->has('attendanceSummary.0.latest_submit'));
    }

    public function test_attendance_page_param_does_not_affect_accomplishments(): void
    {
        // Create 60 accomplishments so page 1 is full and page 2 exists.
        for ($i = 0; $i < 60; $i++) {
            WeeklyAccomplishment::create([
                'project_id' => $this->project->id,
                'foreman_id' => $this->foreman->id,
                'scope_of_work' => "Scope {$i}",
                'percent_completed' => $i,
                'week_start' => now()->subDays($i)->toDateString(),
                'is_placeholder' => false,
            ]);
        }

        Attendance::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'worker_name' => 'Worker A',
            'worker_role' => 'Worker',
            'date' => now()->toDateString(),
            'hours' => 8,
            'attendance_code' => 'P',
        ]);

        // Navigate to att_page=2 — accommplishments should still be on page 1.
        $this->actingAs($this->projectManager)
            ->get("/project-manager/projects/{$this->project->id}?att_page=2")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('accomplishmentsTable.current_page', 1)
                ->where('attendanceSummaryTable.current_page', 2));
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

public function test_project_manager_payroll_search_filter_reflects_in_total_payable(): void
    {
        $cutoff = PayrollCutoff::create([
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-15',
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);

        $this->payrollForCutoff($cutoff->id, 'Juan Dela Cruz');
        $this->payrollForCutoff($cutoff->id, 'Maria Santos');
        $paid = $this->payrollForCutoff($cutoff->id, 'Juan Dela Cruz');
        $paid->update(['status' => Payroll::STATUS_PAID, 'net' => 5000]);

        $this->actingAs($this->projectManager)
            ->get('/project-manager/payroll?search=Juan')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Payroll')
                ->where('payrollTable.search', 'Juan')
                ->where('totalPayable', 4000)
                ->has('payrolls', 2)
                ->where('payrolls.0.worker_name', 'Juan Dela Cruz'));

        $this->actingAs($this->projectManager)
            ->get('/project-manager/payroll?search=Maria')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('totalPayable', 4000)
                ->has('payrolls', 1)
                ->where('payrolls.0.worker_name', 'Maria Santos'));

        $this->actingAs($this->projectManager)
            ->get('/project-manager/payroll?search=NonExistent')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('totalPayable', 0)
                ->has('payrolls', 0));
    }

    public function test_project_manager_payroll_cutoff_filter_reflects_in_total_payable(): void
    {
        $inRange = PayrollCutoff::create([
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-15',
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);
        $outside = PayrollCutoff::create([
            'start_date' => '2026-04-01',
            'end_date' => '2026-04-15',
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);

        $this->payrollForCutoff($inRange->id, 'Juan Dela Cruz');
        $this->payrollForCutoff($outside->id, 'Maria Santos');

        $this->actingAs($this->projectManager)
            ->get('/project-manager/payroll?cutoff_start=2026-07-01&cutoff_end=2026-07-20')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Payroll')
                ->where('payrollTable.cutoff_start', '2026-07-01')
                ->where('payrollTable.cutoff_end', '2026-07-20')
                ->where('totalPayable', 4000)
                ->has('payrolls', 1)
                ->where('payrolls.0.worker_name', 'Juan Dela Cruz'));

        $this->actingAs($this->projectManager)
            ->get('/project-manager/payroll?cutoff_start=2026-04-01&cutoff_end=2026-04-20')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('totalPayable', 4000)
                ->has('payrolls', 1)
                ->where('payrolls.0.worker_name', 'Maria Santos'));
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

    private function payrollForCutoff(int $cutoffId, string $workerName): Payroll
    {
        return Payroll::create([
            'user_id' => $this->projectManager->id,
            'cutoff_id' => $cutoffId,
            'project_id' => $this->project->id,
            'project_name' => $this->project->name,
            'project_client' => $this->project->client,
            'worker_name' => $workerName,
            'role' => 'Worker',
            'hours' => 40,
            'rate_per_hour' => 100,
            'gross' => 4000,
            'deductions' => 0,
            'net' => 4000,
            'status' => 'pending',
            'week_start' => '2026-07-06',
        ]);
    }
}
