<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProjectManagerApiDataTest extends TestCase
{
    use RefreshDatabase;

    private function makePm(string $email = 'api.pm.data@example.test'): User
    {
        return User::create([
            'fullname' => 'Data PM',
            'email' => $email,
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);
    }

    private function makeForeman(string $email, string $name = 'Data Foreman'): User
    {
        return User::create([
            'fullname' => $name,
            'email' => $email,
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);
    }

    private function makeProject(string $name = 'PM Data Project'): Project
    {
        return Project::create([
            'name' => $name,
            'client' => 'Data Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'Construction',
            'overall_progress' => 20,
        ]);
    }

    private function pmToken(string $email = 'api.pm.data@example.test'): string
    {
        return (string) $this->postJson('/api/project-manager/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('token');
    }

    public function test_dashboard_returns_stats_projects_and_submissions(): void
    {
        $this->makePm();
        $foreman = $this->makeForeman('api.pm.data.foreman@example.test');
        $project = $this->makeProject();

        WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'submitted_by' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Foundation',
            'percent_completed' => 25,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);

        $this->getJson('/api/project-manager/dashboard', [
            'Authorization' => 'Bearer '.$this->pmToken(),
        ])->assertOk()
            ->assertJsonPath('stats.total_projects', 1)
            ->assertJsonPath('stats.total_foremen', 1)
            ->assertJsonCount(1, 'projects')
            ->assertJsonPath('projects.0.name', 'PM Data Project')
            ->assertJsonCount(1, 'recent_submissions')
            ->assertJsonPath('recent_submissions.0.scope_of_work', 'Foundation')
            ->assertJsonStructure(['stats', 'projects', 'recent_submissions', 'low_progress_projects', 'foremen']);
    }

    public function test_accomplishments_returns_weekly_grid_for_project_and_foreman(): void
    {
        $this->makePm();
        $foreman = $this->makeForeman('api.pm.data.acc@example.test');
        $project = $this->makeProject('PM Acc Project');
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);

        WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'submitted_by' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Foundation',
            'percent_completed' => 30,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);

        $headers = ['Authorization' => 'Bearer '.$this->pmToken()];

        // Without selection: first project auto-selected with its foremen.
        $this->getJson('/api/project-manager/accomplishments', $headers)
            ->assertOk()
            ->assertJsonPath('selectedProjectId', $project->id)
            ->assertJsonPath('foremen.0.fullname', 'Data Foreman')
            ->assertJsonStructure(['projects', 'foremen', 'weekly']);

        $response = $this->getJson(
            "/api/project-manager/accomplishments?project_id={$project->id}&foreman_id={$foreman->id}",
            $headers
        );

        $response->assertOk()
            ->assertJsonPath('selectedProjectId', $project->id)
            ->assertJsonPath('selectedForemanId', $foreman->id);

        $weekStart = now()->startOfWeek()->toDateString();
        $response->assertJsonPath(
            "weekly.weekly_saved_by_week.{$weekStart}.0.scope_of_work",
            'Foundation'
        );
    }

    public function test_pm_can_save_accomplishment_like_foreman_submission(): void
    {
        $this->makePm();
        $foreman = $this->makeForeman('api.pm.data.save@example.test');
        $project = $this->makeProject('PM Save Project');
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);

        $weekStart = now()->startOfWeek()->toDateString();

        $this->postJson('/api/project-manager/accomplishments', [
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'week_start' => $weekStart,
            'scopes' => [
                ['scope_of_work' => 'Foundation', 'percent_completed' => 45],
            ],
        ], [
            'Authorization' => 'Bearer '.$this->pmToken(),
        ])->assertOk()
            ->assertJsonPath('message', 'Accomplishment updated successfully.');

        $this->assertDatabaseHas('weekly_accomplishments', [
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'scope_of_work' => 'Foundation',
        ]);
    }

    public function test_pm_can_save_accomplishment_with_scope_photo(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $this->makePm();
        $foreman = $this->makeForeman('api.pm.data.save.photo@example.test', 'Photo Foreman');
        $project = $this->makeProject('PM Save Photo Project');
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);
        \App\Models\ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Foundation',
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
            'assigned_personnel' => 'Photo Foreman',
        ]);

        $photo = \Illuminate\Http\UploadedFile::fake()->image('scope.jpg', 800, 600);

        $this->post('/api/project-manager/accomplishments', [
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'week_start' => now()->startOfWeek()->toDateString(),
            'scopes' => [
                [
                    'scope_of_work' => 'Foundation',
                    'percent_completed' => 45,
                    'photo_caption' => 'Footing done',
                    'photos' => [$photo],
                ],
            ],
        ], [
            'Authorization' => 'Bearer '.$this->pmToken(),
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('message', 'Accomplishment updated successfully.');

        $this->assertDatabaseHas('weekly_accomplishments', [
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'scope_of_work' => 'Foundation',
        ]);
        $this->assertDatabaseCount('scope_photos', 1);
    }

    public function test_store_accomplishment_validates_input(): void
    {
        $this->makePm();

        // Unassigned foreman must be rejected, same as the web page.
        $foreman = $this->makeForeman('api.pm.data.save.invalid@example.test');
        $project = $this->makeProject('PM Save Invalid Project');

        $this->postJson('/api/project-manager/accomplishments', [
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'week_start' => now()->startOfWeek()->toDateString(),
            'scopes' => [
                ['scope_of_work' => 'Foundation', 'percent_completed' => 45],
            ],
        ], [
            'Authorization' => 'Bearer '.$this->pmToken(),
        ])->assertStatus(422);
    }

    public function test_attendance_returns_rows_with_filters(): void
    {
        $this->makePm();
        $foreman = $this->makeForeman('api.pm.data.att@example.test');
        $project = $this->makeProject('PM Att Project');

        Attendance::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'worker_name' => 'Site Worker',
            'worker_role' => 'Mason',
            'date' => now()->toDateString(),
            'hours' => 8,
            'attendance_code' => 'P',
        ]);

        $headers = ['Authorization' => 'Bearer '.$this->pmToken()];

        $this->getJson('/api/project-manager/attendance', $headers)
            ->assertOk()
            ->assertJsonPath('table.total', 1)
            ->assertJsonPath('attendances.0.worker_name', 'Site Worker')
            ->assertJsonStructure(['attendances', 'projects', 'foremen', 'table']);

        // Search filter narrows results.
        $this->getJson('/api/project-manager/attendance?search=No+Such+Worker', $headers)
            ->assertOk()
            ->assertJsonPath('table.total', 0);

        $this->getJson(
            "/api/project-manager/attendance?project_id={$project->id}&foreman_id={$foreman->id}",
            $headers
        )->assertOk()->assertJsonPath('table.total', 1);
    }

    public function test_payroll_returns_rows_total_and_cutoffs(): void
    {
        $pm = $this->makePm();
        $project = $this->makeProject('PM Payroll Project');

        $cutoff = PayrollCutoff::create([
            'start_date' => now()->startOfMonth()->toDateString(),
            'end_date' => now()->endOfMonth()->toDateString(),
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);

        Payroll::create([
            'user_id' => $pm->id,
            'project_id' => $project->id,
            'project_name' => $project->name,
            'cutoff_id' => $cutoff->id,
            'worker_name' => 'Payroll Worker',
            'role' => 'Mason',
            'hours' => 40,
            'rate_per_hour' => 100,
            'gross' => 4000,
            'deductions' => 0,
            'net' => 4000,
            'status' => 'pending',
            'week_start' => now()->startOfWeek()->toDateString(),
        ]);

        $this->getJson("/api/project-manager/payroll?project_id={$project->id}", [
            'Authorization' => 'Bearer '.$this->pmToken(),
        ])->assertOk()
            ->assertJsonPath('payrolls.0.worker_name', 'Payroll Worker')
            ->assertJsonPath('payrolls.0.net', 4000)
            ->assertJsonPath('payrolls.0.status', 'pending')
            ->assertJsonPath('payrolls.0.cutoff.start_date', now()->startOfMonth()->toDateString())
            ->assertJsonPath('payrolls.0.cutoff.end_date', now()->endOfMonth()->toDateString())
            ->assertJsonPath('total_payable', 4000)
            ->assertJsonCount(1, 'cutoffs')
            ->assertJsonStructure(['payrolls', 'total_payable', 'cutoffs', 'table']);
    }

    public function test_project_detail_returns_accomplishments_and_attendance(): void
    {
        $this->makePm();
        $foreman = $this->makeForeman('api.pm.data.proj@example.test');
        $project = $this->makeProject('PM Detail Project');

        WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'submitted_by' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Foundation',
            'percent_completed' => 50,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);
        Attendance::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'worker_name' => 'Detail Worker',
            'worker_role' => 'Laborer',
            'date' => now()->toDateString(),
            'hours' => 8,
            'attendance_code' => 'P',
        ]);

        $this->getJson("/api/project-manager/projects/{$project->id}", [
            'Authorization' => 'Bearer '.$this->pmToken(),
        ])->assertOk()
            ->assertJsonPath('project.name', 'PM Detail Project')
            ->assertJsonCount(1, 'accomplishments')
            ->assertJsonPath('accomplishments.0.scope_of_work', 'Foundation')
            ->assertJsonCount(1, 'attendanceSummary')
            ->assertJsonStructure(['project', 'accomplishments', 'attendanceSummary', 'projectStats']);
    }

    public function test_dashboard_progress_matches_projects_kanban(): void
    {
        $this->makePm();
        // Stored column holds a stale simple average (90); the weighted
        // kanban computation (15*25/100 = 3.75) must win everywhere.
        $project = $this->makeProject('PM Parity Project');
        $project->update(['overall_progress' => 90]);

        \App\Models\ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Parity Scope',
            'progress_percent' => 25,
            'status' => 'IN_PROGRESS',
            'weight_percent' => 15,
        ]);

        $headers = ['Authorization' => 'Bearer '.$this->pmToken()];

        $this->getJson('/api/project-manager/dashboard', $headers)
            ->assertOk()
            ->assertJsonPath('projects.0.overall_progress', 3.75)
            ->assertJsonPath('low_progress_projects.0.overall_progress', 3.75)
            ->assertJsonPath('stats.low_progress_projects', 1);

        $this->getJson('/api/project-manager/projects', $headers)
            ->assertOk()
            ->assertJsonPath('projects.0.overall_progress', 3.75);

        $this->getJson("/api/project-manager/projects/{$project->id}", $headers)
            ->assertOk()
            ->assertJsonPath('project.overall_progress', 3.75);
    }

    public function test_project_detail_supports_20_per_page_show_more(): void
    {
        $this->makePm('api.pm.data.more@example.test');
        $foreman = $this->makeForeman('api.pm.data.more.foreman@example.test');
        $project = $this->makeProject('PM More Project');

        for ($i = 0; $i < 25; $i++) {
            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'submitted_by' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => "Scope {$i}",
                'percent_completed' => $i,
                'week_start' => now()->startOfWeek()->toDateString(),
                'is_placeholder' => false,
            ]);
        }

        $token = $this->pmToken('api.pm.data.more@example.test');
        $headers = ['Authorization' => 'Bearer '.$token];

        // Page 1 holds 20 of 25 rows across 2 pages.
        $this->getJson(
            "/api/project-manager/projects/{$project->id}?acc_per_page=20&acc_page=1",
            $headers
        )->assertOk()
            ->assertJsonCount(20, 'accomplishments')
            ->assertJsonPath('accomplishmentsTable.per_page', 20)
            ->assertJsonPath('accomplishmentsTable.current_page', 1)
            ->assertJsonPath('accomplishmentsTable.last_page', 2)
            ->assertJsonPath('accomplishmentsTable.total', 25);

        // "Show more" fetches the remaining 5 rows.
        $this->getJson(
            "/api/project-manager/projects/{$project->id}?acc_per_page=20&acc_page=2",
            $headers
        )->assertOk()
            ->assertJsonCount(5, 'accomplishments')
            ->assertJsonPath('accomplishmentsTable.current_page', 2);

        // Default stays 50 for existing clients.
        $this->getJson("/api/project-manager/projects/{$project->id}", $headers)
            ->assertOk()
            ->assertJsonPath('accomplishmentsTable.per_page', 50);
    }

    public function test_attendance_foremen_scoped_to_selected_project(): void
    {
        $this->makePm('api.pm.data.scope@example.test');
        $assigned = $this->makeForeman('api.pm.data.scope.a@example.test', 'Scoped Foreman A');
        $this->makeForeman('api.pm.data.scope.b@example.test', 'Scoped Foreman B');
        $project = $this->makeProject('PM Scope Project');
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $assigned->id,
            'role_in_project' => 'foreman',
        ]);

        $headers = ['Authorization' => 'Bearer '.$this->pmToken('api.pm.data.scope@example.test')];

        // No project selected: every foreman is offered.
        $this->getJson('/api/project-manager/attendance', $headers)
            ->assertOk()
            ->assertJsonCount(2, 'foremen');

        // With a project selected: only its assigned foreman is offered.
        $this->getJson("/api/project-manager/attendance?project_id={$project->id}", $headers)
            ->assertOk()
            ->assertJsonCount(1, 'foremen')
            ->assertJsonPath('foremen.0.fullname', 'Scoped Foreman A');
    }

    public function test_payroll_without_project_id_uses_default_project_like_web(): void
    {
        $pm = $this->makePm('api.pm.data.nodefault@example.test');
        // Alphabetically-first project has NO payroll; the latest payroll
        // belongs to the second project. Without project_id the API must
        // resolve the latest tagged project (like the web page), not the
        // first option and not an empty list.
        $other = $this->makeProject('AAA Empty Project');

        $cutoff = PayrollCutoff::create([
            'start_date' => now()->startOfMonth()->toDateString(),
            'end_date' => now()->endOfMonth()->toDateString(),
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);

        $project = $this->makeProject('ZZZ Payroll Project');
        Payroll::create([
            'user_id' => $pm->id,
            'project_id' => $project->id,
            'project_name' => $project->name,
            'cutoff_id' => $cutoff->id,
            'worker_name' => 'Default Project Worker',
            'role' => 'Mason',
            'hours' => 40,
            'rate_per_hour' => 100,
            'gross' => 4000,
            'deductions' => 0,
            'net' => 4000,
            'status' => 'pending',
            'week_start' => now()->startOfWeek()->toDateString(),
        ]);

        $this->getJson('/api/project-manager/payroll', [
            'Authorization' => 'Bearer '.$this->pmToken('api.pm.data.nodefault@example.test'),
        ])->assertOk()
            ->assertJsonPath('payrolls.0.worker_name', 'Default Project Worker')
            ->assertJsonPath('total_payable', 4000);
    }

    public function test_payroll_supports_20_per_page_show_more(): void
    {
        $pm = $this->makePm('api.pm.data.more20@example.test');
        $project = $this->makeProject('PM More20 Project');
        $cutoff = PayrollCutoff::create([
            'start_date' => now()->startOfMonth()->toDateString(),
            'end_date' => now()->endOfMonth()->toDateString(),
            'status' => PayrollCutoff::STATUS_GENERATED,
        ]);

        for ($i = 0; $i < 25; $i++) {
            Payroll::create([
                'user_id' => $pm->id,
                'project_id' => $project->id,
                'cutoff_id' => $cutoff->id,
                'worker_name' => "Worker {$i}",
                'role' => 'Mason',
                'hours' => 40,
                'rate_per_hour' => 100,
                'gross' => 4000,
                'deductions' => 0,
                'net' => 4000,
                'status' => 'pending',
                'week_start' => now()->startOfWeek()->toDateString(),
            ]);
        }

        $headers = ['Authorization' => 'Bearer '.$this->pmToken('api.pm.data.more20@example.test')];

        $this->getJson(
            "/api/project-manager/payroll?project_id={$project->id}&per_page=20&page=1",
            $headers
        )->assertOk()
            ->assertJsonCount(20, 'payrolls')
            ->assertJsonPath('table.per_page', 20)
            ->assertJsonPath('table.current_page', 1)
            ->assertJsonPath('table.last_page', 2)
            ->assertJsonPath('table.total', 25);

        $this->getJson(
            "/api/project-manager/payroll?project_id={$project->id}&per_page=20&page=2",
            $headers
        )->assertOk()
            ->assertJsonCount(5, 'payrolls')
            ->assertJsonPath('table.current_page', 2);
    }

    public function test_data_endpoints_reject_unauthenticated_and_foreman_tokens(): void
    {
        $this->getJson('/api/project-manager/dashboard')->assertUnauthorized();
        $this->getJson('/api/project-manager/attendance')->assertUnauthorized();
        $this->getJson('/api/project-manager/payroll')->assertUnauthorized();

        $foreman = $this->makeForeman('api.pm.data.cross@example.test');
        $token = (string) $this->postJson('/api/foreman/login', [
            'email' => 'api.pm.data.cross@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->assertNotEmpty($token);
        $this->getJson('/api/project-manager/dashboard', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }
}
