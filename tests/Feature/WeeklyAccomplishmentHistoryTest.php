<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class WeeklyAccomplishmentHistoryTest extends TestCase
{
    use RefreshDatabase;

    private User $headAdmin;

    private User $projectManager;

    private User $foreman;

    private Project $project;

    private string $weekStart;

    protected function setUp(): void
    {
        parent::setUp();

        $this->headAdmin = $this->makeUser('head_admin');
        $this->projectManager = $this->makeUser('project_manager');
        $this->foreman = $this->makeUser('foreman');

        $this->project = Project::create([
            'name' => 'History Project',
            'client' => 'History Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => $this->foreman->fullname,
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
            'user_id' => $this->headAdmin->id,
        ]);

        $this->weekStart = Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();

        ProjectAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->projectManager->id,
            'role_in_project' => ProjectAssignment::ROLE_PROJECT_MANAGER,
        ]);
    }

    public function test_foreman_submit_then_pm_save_creates_two_independent_rows(): void
    {
        $this->actingAs($this->foreman)
            ->post('/foreman/submit-all', [
                'week_start' => $this->weekStart,
                'accomplishment_project_id' => $this->project->id,
                'scopes' => [
                    ['scope_of_work' => 'Mobilization and Hauling', 'percent_completed' => 30],
                ],
            ])
            ->assertRedirect();

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $this->weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Mobilization and Hauling', 'percent_completed' => 60],
                ],
            ])
            ->assertRedirect();

        // Both submissions are kept on their own sides — nothing is overwritten.
        $this->assertDatabaseCount('weekly_accomplishments', 2);
        $this->assertDatabaseHas('weekly_accomplishments', [
            'foreman_id' => $this->foreman->id,
            'submitted_by' => $this->foreman->id,
            'scope_of_work' => 'Mobilization and Hauling',
            'percent_completed' => 30,
        ]);
        $this->assertDatabaseHas('weekly_accomplishments', [
            'foreman_id' => null,
            'submitted_by' => $this->projectManager->id,
            'scope_of_work' => 'Mobilization and Hauling',
            'percent_completed' => 60,
        ]);

        // The project snapshot stays foreman-driven (latest foreman value).
        $this->assertDatabaseHas('projects', [
            'id' => $this->project->id,
            'overall_progress' => 30,
        ]);
    }

    public function test_untouched_pm_resubmit_with_same_percent_creates_no_row(): void
    {
        // PM saves 30 — one independent row.
        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $this->weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Mobilization and Hauling', 'percent_completed' => 30],
                ],
            ])
            ->assertRedirect();

        // PM resubmits the identical value — untouched, no new record.
        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $this->weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Mobilization and Hauling', 'percent_completed' => 30],
                ],
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('weekly_accomplishments', 1);

        // A changed value still records.
        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $this->weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Mobilization and Hauling', 'percent_completed' => 31],
                ],
            ])
            ->assertRedirect();

        $this->assertDatabaseCount('weekly_accomplishments', 2);
    }

    public function test_submitted_by_filter_options_include_foremen_and_project_managers(): void
    {
        $this->actingAs($this->headAdmin)
            ->get('/weekly-accomplishments')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('filterSubmitters', fn ($options) => collect($options)->contains(
                    fn ($option) => (int) ($option['id'] ?? 0) === (int) $this->foreman->id
                        && ($option['role'] ?? '') === 'foreman'
                ) && collect($options)->contains(
                    fn ($option) => (int) ($option['id'] ?? 0) === (int) $this->projectManager->id
                        && ($option['role'] ?? '') === 'project_manager'
                )));
    }

    public function test_weekly_listing_shows_history_newest_first_with_submitter_attribution(): void
    {
        WeeklyAccomplishment::query()->create([
            'foreman_id' => $this->foreman->id,
            'submitted_by' => $this->foreman->id,
            'project_id' => $this->project->id,
            'scope_of_work' => 'Mobilization and Hauling',
            'percent_completed' => 30,
            'week_start' => $this->weekStart,
            'is_placeholder' => false,
        ]);

        // Ensure distinct submitted timestamps so ordering is deterministic.
        $this->travel(1)->second();

        WeeklyAccomplishment::query()->create([
            'foreman_id' => $this->foreman->id,
            'submitted_by' => $this->projectManager->id,
            'project_id' => $this->project->id,
            'scope_of_work' => 'Mobilization and Hauling',
            'percent_completed' => 60,
            'week_start' => $this->weekStart,
            'is_placeholder' => false,
        ]);

        $this->actingAs($this->headAdmin)
            ->get('/weekly-accomplishments')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('weeklyAccomplishments', 2)
                ->where('weeklyAccomplishments.0.percent_completed', '60.00')
                ->where('weeklyAccomplishments.0.submitted_by_name', $this->projectManager->fullname)
                ->where('weeklyAccomplishments.0.submitted_by_role', 'Project Manager')
                ->where('weeklyAccomplishments.1.percent_completed', '30.00')
                ->where('weeklyAccomplishments.1.submitted_by_name', $this->foreman->fullname)
                ->where('weeklyAccomplishments.1.submitted_by_role', 'Foreman'));
    }

    public function test_legacy_rows_without_submitter_fall_back_to_foreman(): void
    {
        WeeklyAccomplishment::query()->create([
            'foreman_id' => $this->foreman->id,
            'submitted_by' => null,
            'project_id' => $this->project->id,
            'scope_of_work' => 'Column',
            'percent_completed' => 25,
            'week_start' => $this->weekStart,
            'is_placeholder' => false,
        ]);

        $this->actingAs($this->headAdmin)
            ->get('/weekly-accomplishments')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('weeklyAccomplishments.0.submitted_by_name', $this->foreman->fullname)
                ->where('weeklyAccomplishments.0.submitted_by_role', 'Foreman'));
    }

    public function test_search_matches_submitter_name_and_role(): void
    {
        WeeklyAccomplishment::query()->create([
            'foreman_id' => $this->foreman->id,
            'submitted_by' => $this->foreman->id,
            'project_id' => $this->project->id,
            'scope_of_work' => 'Column',
            'percent_completed' => 30,
            'week_start' => $this->weekStart,
            'is_placeholder' => false,
        ]);
        WeeklyAccomplishment::query()->create([
            'foreman_id' => $this->foreman->id,
            'submitted_by' => $this->projectManager->id,
            'project_id' => $this->project->id,
            'scope_of_work' => 'Roofing',
            'percent_completed' => 60,
            'week_start' => $this->weekStart,
            'is_placeholder' => false,
        ]);

        // Search by the PM's name finds only the PM-submitted row.
        $this->actingAs($this->headAdmin)
            ->get('/weekly-accomplishments?search=' . urlencode($this->projectManager->fullname))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('weeklyAccomplishments', 1)
                ->where('weeklyAccomplishments.0.scope_of_work', 'Roofing'));

        // Search by user type finds PM-submitted rows.
        $this->actingAs($this->headAdmin)
            ->get('/weekly-accomplishments?search=' . urlencode('Project Manager'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('weeklyAccomplishments', 1)
                ->where('weeklyAccomplishments.0.scope_of_work', 'Roofing'));
    }

    public function test_real_submission_clears_matching_placeholder(): void
    {
        WeeklyAccomplishment::query()->create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'scope_of_work' => 'Column',
            'percent_completed' => 10,
            'week_start' => $this->weekStart,
            'is_placeholder' => true,
        ]);

        $this->actingAs($this->foreman)
            ->post('/foreman/submit-all', [
                'week_start' => $this->weekStart,
                'accomplishment_project_id' => $this->project->id,
                'scopes' => [
                    ['scope_of_work' => 'Column', 'percent_completed' => 40],
                ],
            ])
            ->assertRedirect();

        $this->assertDatabaseMissing('weekly_accomplishments', [
            'project_id' => $this->project->id,
            'scope_of_work' => 'Column',
            'is_placeholder' => true,
        ]);
        $this->assertDatabaseHas('weekly_accomplishments', [
            'project_id' => $this->project->id,
            'scope_of_work' => 'Column',
            'percent_completed' => 40,
            'is_placeholder' => false,
        ]);
    }

    public function test_pm_grid_shows_single_latest_row_per_scope(): void
    {
        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $this->weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Column', 'percent_completed' => 20],
                ],
            ])
            ->assertRedirect();

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $this->weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Column', 'percent_completed' => 70],
                ],
            ])
            ->assertRedirect();

        $this->actingAs($this->projectManager)
            ->get('/project-manager/accomplishments?project_id=' . $this->project->id . '&week_start=' . $this->weekStart)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('savedScopes', fn ($scopes) => $scopes->count() === 1
                    && (float) ($scopes[0]['percent_completed'] ?? 0) === 70.0));
    }

    public function test_head_admin_can_delete_scope_photo_from_weekly_page(): void
    {
        $scope = \App\Models\ProjectScope::create([
            'project_id' => $this->project->id,
            'scope_name' => 'Masonry',
            'weight_percent' => 10,
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
        ]);

        $photo = \App\Models\ScopePhoto::create([
            'project_scope_id' => $scope->id,
            'photo_path' => 'scope-photos/weekly-delete.jpg',
            'caption' => '[PM Weekly] | Week: ' . $this->weekStart . ' | Scope: Masonry',
        ]);

        $this->actingAs($this->headAdmin)
            ->delete('/weekly-accomplishments/scope-photos/' . $photo->id)
            ->assertRedirect();

        $this->assertSoftDeleted('scope_photos', ['id' => $photo->id]);
    }

    public function test_foreman_cannot_delete_scope_photo_from_weekly_page(): void
    {
        $scope = \App\Models\ProjectScope::create([
            'project_id' => $this->project->id,
            'scope_name' => 'Masonry',
            'weight_percent' => 10,
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
        ]);

        $photo = \App\Models\ScopePhoto::create([
            'project_scope_id' => $scope->id,
            'photo_path' => 'scope-photos/weekly-keep.jpg',
            'caption' => '[PM Weekly] | Week: ' . $this->weekStart . ' | Scope: Masonry',
        ]);

        $this->actingAs($this->foreman)
            ->delete('/weekly-accomplishments/scope-photos/' . $photo->id)
            ->assertForbidden();

        $this->assertDatabaseHas('scope_photos', ['id' => $photo->id]);
    }

    private function makeUser(string $role): User
    {
        return User::create([
            'fullname' => ucfirst($role) . ' ' . uniqid(),
            'email' => $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }
}
