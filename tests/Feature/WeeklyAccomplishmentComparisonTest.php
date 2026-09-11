<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class WeeklyAccomplishmentComparisonTest extends TestCase
{
    use RefreshDatabase;

    public function test_comparison_rows_split_pm_and_foreman_by_submitter_role(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $projectManager = $this->makeUser('project_manager');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Aqua Residences', $headAdmin->id);
            $this->seedScope($project, 'Column Footing');

            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'submitted_by' => $projectManager->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Column Footing',
                'percent_completed' => 62,
                'week_start' => '2026-08-17',
            ]);
            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'submitted_by' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Column Footing',
                'percent_completed' => 55,
                'week_start' => '2026-08-17',
            ]);

            // Newest submission (foreman's 55) sets the scope truth, so both
            // columns read 55 with zero variance.
            // PM and foreman latest values stay on their own sides:
            // PM 62 vs foreman 55 on the common scope = 7% Needs Review.
            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('comparisonRows', 1)
                    ->where('comparisonRows.0.project_name', 'Aqua Residences')
                    ->where('comparisonRows.0.pm_progress', 62)
                    ->where('comparisonRows.0.foreman_progress', 55)
                    ->where('comparisonRows.0.variance', 7)
                    ->where('comparisonRows.0.status', 'Needs Review')
                    ->has('overviewStats')
                    ->where('overviewStats.total_projects', 1)
                    ->where('overviewStats.needs_review', 1)
                    ->has('workInfoMap'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_variance_thresholds_map_to_status(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $projectManager = $this->makeUser('project_manager');
            $foreman = $this->makeUser('foreman');

            $onTrack = $this->makeProject('On Track Project', $headAdmin->id);
            $needsReview = $this->makeProject('Needs Review Project', $headAdmin->id);
            $investigate = $this->makeProject('Investigate Project', $headAdmin->id);
            $this->seedScope($onTrack, 'Column Footing');
            $this->seedScope($needsReview, 'Column Footing');
            $this->seedScope($investigate, 'Column Footing');

            $this->seedPair($projectManager, $foreman, $onTrack, 49, 48); // 1% On Track
            $this->seedPair($projectManager, $foreman, $needsReview, 62, 55); // 7% Needs Review
            $this->seedPair($projectManager, $foreman, $investigate, 75, 61); // 14% Investigate

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->where('overviewStats.total_projects', 3)
                    ->where('overviewStats.on_track', 1)
                    ->where('overviewStats.needs_review', 1)
                    ->where('overviewStats.with_discrepancy', 1));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_admin_can_view_comparison_payload(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)
            ->get('/weekly-accomplishments')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('comparisonRows')
                ->has('overviewStats')
                ->has('workInfoMap'));
    }

    public function test_detail_page_returns_project_breakdown(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $projectManager = $this->makeUser('project_manager');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Aqua Residences', $headAdmin->id);
            $this->seedScope($project, 'Column Footing');

            $this->seedPair($projectManager, $foreman, $project, 62, 55);

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments/' . $project->id)
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Show')
                    ->where('project.name', 'Aqua Residences')
                    ->where('comparison.pm_progress', 62)
                    ->where('comparison.foreman_progress', 55)
                    ->where('comparison.variance', 7)
                    ->where('comparison.status', 'Needs Review')
                    ->has('scopeBreakdown', 1)
                    ->where('scopeBreakdown.0.scope', 'Column Footing')
                    ->where('scopeBreakdown.0.pm', 62)
                    ->where('scopeBreakdown.0.foreman', 55)
                    ->has('recentPmSubmission')
                    ->has('recentForemanSubmission')
                    ->has('rows', 2)
                    ->has('workInfoMap'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_detail_page_forbidden_for_foreman(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Aqua Residences', $headAdmin->id);

        $this->actingAs($foreman)
            ->get('/weekly-accomplishments/' . $project->id)
            ->assertForbidden();
    }

    public function test_latest_submission_wins_per_scope_per_side(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $projectManager = $this->makeUser('project_manager');
            $masterAdmin = $this->makeUser('master_admin');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Latest Wins Project', $headAdmin->id);
            $this->seedScope($project, 'Mobilization and Hauling');

            // Mirrors the production report: stale 35s, then PM 40, then 0.
            // Latest per side must win — not the oldest, not the average.
            foreach ([
                [$foreman, 35],
                [$projectManager, 35],
                [$projectManager, 40],
                [$masterAdmin, 0],
            ] as [$submitter, $percent]) {
                WeeklyAccomplishment::create([
                    'foreman_id' => $foreman->id,
                    'submitted_by' => $submitter->id,
                    'project_id' => $project->id,
                    'scope_of_work' => 'Mobilization and Hauling',
                    'percent_completed' => $percent,
                    'week_start' => '2026-08-17',
                ]);
            }

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments/' . $project->id)
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Show')
                    ->where('comparison.pm_progress', 40)
                    ->where('comparison.foreman_progress', 0)
                    ->where('comparison.variance', 40)
                    ->where('comparison.status', 'Investigate')
                    ->has('scopeBreakdown', 1)
                    ->where('scopeBreakdown.0.pm', 40)
                    ->where('scopeBreakdown.0.foreman', 0)
                    ->where('scopeBreakdown.0.status', 'Investigate'));

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('comparisonRows', 1)
                    ->where('comparisonRows.0.pm_progress', 40)
                    ->where('comparisonRows.0.foreman_progress', 0)
                    ->where('comparisonRows.0.variance', 40)
                    ->where('comparisonRows.0.status', 'Investigate'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_missing_pm_side_shows_pending_instead_of_mirrored_values(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Foreman Only Project', $headAdmin->id);
            $this->seedScope($project, 'Column Footing');
            $this->seedScope($project, 'Mobilization and Hauling');

            // Fresh project: only JotForm (foreman) submissions, no PM save.
            // The PM side must stay missing — never a copy of foreman values.
            foreach ([['Column Footing', 27], ['Mobilization and Hauling', 25]] as [$scope, $percent]) {
                WeeklyAccomplishment::create([
                    'foreman_id' => $foreman->id,
                    'submitted_by' => $foreman->id,
                    'project_id' => $project->id,
                    'scope_of_work' => $scope,
                    'percent_completed' => $percent,
                    'week_start' => '2026-08-17',
                ]);
            }

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('comparisonRows', 1)
                    ->where('comparisonRows.0.pm_progress', null)
                    ->where('comparisonRows.0.foreman_progress', 26)
                    ->where('comparisonRows.0.variance', null)
                    ->where('comparisonRows.0.status', 'Pending')
                    ->where('overviewStats.pending', 1));

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments/' . $project->id)
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Show')
                    ->where('comparison.pm_progress', null)
                    ->where('comparison.foreman_progress', 26)
                    ->where('comparison.status', 'Pending')
                    ->has('scopeBreakdown', 2)
                    ->where('scopeBreakdown.0.pm', null)
                    ->where('scopeBreakdown.0.foreman', 27)
                    ->where('scopeBreakdown.0.status', 'Pending'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_variance_compares_only_common_scopes(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $projectManager = $this->makeUser('project_manager');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Partial Overlap Project', $headAdmin->id);
            $this->seedScope($project, 'Mobilization and Hauling');
            $this->seedScope($project, 'Foundation Preparation');

            // Foreman touches two scopes, PM reviews only one of them.
            // Sides keep their own averages, but variance must come from the
            // commonly-submitted scope only: |28 - 27| = 1, not |28 - 26|.
            foreach ([
                [$foreman, 'Mobilization and Hauling', 27],
                [$foreman, 'Foundation Preparation', 25],
                [$projectManager, 'Mobilization and Hauling', 28],
            ] as [$submitter, $scope, $percent]) {
                WeeklyAccomplishment::create([
                    'foreman_id' => $foreman->id,
                    'submitted_by' => $submitter->id,
                    'project_id' => $project->id,
                    'scope_of_work' => $scope,
                    'percent_completed' => $percent,
                    'week_start' => '2026-08-17',
                ]);
            }

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('comparisonRows', 1)
                    ->where('comparisonRows.0.pm_progress', 14)
                    ->where('comparisonRows.0.foreman_progress', 26)
                    ->where('comparisonRows.0.variance', 1)
                    ->where('comparisonRows.0.status', 'On Track'));

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments/' . $project->id)
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Show')
                    ->where('comparison.variance', 1)
                    ->where('comparison.status', 'On Track')
                    ->has('scopeBreakdown', 2));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_adding_a_low_scope_never_drags_the_average_down(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Monotonic Project', $headAdmin->id);
            $this->seedScope($project, 'Scope A');
            $this->seedScope($project, 'Scope B');
            $this->seedScope($project, 'Scope C');

            // Unsubmitted scopes count as 0 over the entire 3-scope plan.
            foreach ([['Scope A', 27], ['Scope B', 25]] as [$scope, $percent]) {
                WeeklyAccomplishment::create([
                    'foreman_id' => $foreman->id,
                    'submitted_by' => $foreman->id,
                    'project_id' => $project->id,
                    'scope_of_work' => $scope,
                    'percent_completed' => $percent,
                    'week_start' => '2026-08-17',
                ]);
            }

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->where('comparisonRows.0.foreman_progress', 17.33));

            // Submitting the remaining scope at 10 raises the average —
            // previously it fell from 26 to 20.67 under submitted-only math.
            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'submitted_by' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Scope C',
                'percent_completed' => 10,
                'week_start' => '2026-08-17',
            ]);

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->where('comparisonRows.0.foreman_progress', 20.67)
                    ->where('comparisonRows.0.status', 'Pending'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_scope_photos_and_rows_carry_project_ids_for_scoping(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Photo Scope Project', $headAdmin->id);
            $this->seedScope($project, 'Excavation');

            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'submitted_by' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Excavation',
                'percent_completed' => 40,
                'week_start' => '2026-08-17',
            ]);

            $scope = ProjectScope::where('project_id', $project->id)->where('scope_name', 'Excavation')->firstOrFail();
            ScopePhoto::create([
                'project_scope_id' => $scope->id,
                'photo_path' => 'excavation-week.jpg',
                'caption' => 'Week: 2026-08-17',
            ]);

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?project_id=' . $project->id . '&week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('weeklyAccomplishments', 1)
                    ->where('weeklyAccomplishments.0.project_id_real', $project->id)
                    ->has('weeklyScopePhotoMap.excavation', 1)
                    ->where('weeklyScopePhotoMap.excavation.0.project_id', $project->id));
        } finally {
            Carbon::setTestNow();
        }
    }

    private function seedScope(Project $project, string $scope): void
    {
        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => $scope,
        ]);
    }

    private function seedPair(User $projectManager, User $foreman, Project $project, float $pm, float $foremanPercent): void
    {
        WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'submitted_by' => $projectManager->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Column Footing',
            'percent_completed' => $pm,
            'week_start' => '2026-08-17',
        ]);
        WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'submitted_by' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Column Footing',
            'percent_completed' => $foremanPercent,
            'week_start' => '2026-08-17',
        ]);
    }

    private function makeUser(string $role): User
    {
        return User::create([
            'fullname' => ucfirst(str_replace('_', ' ', $role)) . ' ' . uniqid(),
            'email' => $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }

    private function makeProject(string $name, ?int $userId = null): Project
    {
        return Project::create([
            'name' => $name,
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'Cebu City, Philippines',
            'assigned' => null,
            'target' => '2026-12-31',
            'status' => 'ONGOING',
            'phase' => 'Construction',
            'overall_progress' => 62,
            'user_id' => $userId,
        ]);
    }
}
