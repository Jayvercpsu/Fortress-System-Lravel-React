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
            $this->seedScope($project, 'Column Footing', 100);

            WeeklyAccomplishment::create([
                'foreman_id' => null,
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
            $this->seedScope($onTrack, 'Column Footing', 100);
            $this->seedScope($needsReview, 'Column Footing', 100);
            $this->seedScope($investigate, 'Column Footing', 100);

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
            $this->seedScope($project, 'Column Footing', 100);

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

    public function test_detail_submissions_paginate_pm_side_by_fifty(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $projectManager = $this->makeUser('project_manager');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Paged Residences', $headAdmin->id);
        $this->seedScope($project, 'Column Footing');

        for ($i = 0; $i < 55; $i++) {
            WeeklyAccomplishment::create([
                'foreman_id' => null,
                'submitted_by' => $projectManager->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Column Footing',
                'percent_completed' => 10 + ($i % 80),
                'week_start' => '2026-08-17',
            ]);
        }

        // Page 1 ships inside the detail payload with server totals.
        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments/' . $project->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Show')
                ->where('submissionTotals.pm', 55)
                ->where('submissionTotals.foreman', 0)
                ->has('rows', 50));

        // Older pages load through the JSON endpoint, 50 per page.
        $this->actingAs($headAdmin)
            ->getJson('/weekly-accomplishments/' . $project->id . '/submissions?side=pm&page=1')
            ->assertOk()
            ->assertJsonPath('total', 55)
            ->assertJsonPath('per_page', 50)
            ->assertJsonPath('last_page', 2)
            ->assertJsonCount(50, 'data');

        $this->actingAs($headAdmin)
            ->getJson('/weekly-accomplishments/' . $project->id . '/submissions?side=pm&page=2')
            ->assertOk()
            ->assertJsonPath('current_page', 2)
            ->assertJsonCount(5, 'data');

        $this->actingAs($headAdmin)
            ->getJson('/weekly-accomplishments/' . $project->id . '/submissions?side=foreman')
            ->assertOk()
            ->assertJsonPath('total', 0)
            ->assertJsonCount(0, 'data');
    }

    public function test_detail_photos_paginate_by_twenty_one(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $project = $this->makeProject('Photo Residences', $headAdmin->id);
        $this->seedScope($project, 'Column Footing');
        $scopeId = ProjectScope::where('project_id', $project->id)->value('id');

        for ($i = 0; $i < 25; $i++) {
            ScopePhoto::create([
                'project_scope_id' => $scopeId,
                'photo_path' => "photos/paged-{$i}.jpg",
                'caption' => 'Progress photo',
            ]);
        }

        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments/' . $project->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('photoTotal', 25));

        $this->actingAs($headAdmin)
            ->getJson('/weekly-accomplishments/' . $project->id . '/photos?page=1')
            ->assertOk()
            ->assertJsonPath('total', 25)
            ->assertJsonPath('per_page', 21)
            ->assertJsonPath('last_page', 2)
            ->assertJsonCount(21, 'data');

        $this->actingAs($headAdmin)
            ->getJson('/weekly-accomplishments/' . $project->id . '/photos?page=2')
            ->assertOk()
            ->assertJsonCount(4, 'data');
    }

    public function test_detail_paging_endpoints_forbid_foreman(): void
    {
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Paged Residences', null);

        $this->actingAs($foreman)
            ->getJson('/weekly-accomplishments/' . $project->id . '/submissions?side=pm')
            ->assertForbidden();

        $this->actingAs($foreman)
            ->getJson('/weekly-accomplishments/' . $project->id . '/photos')
            ->assertForbidden();
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
            $this->seedScope($project, 'Mobilization and Hauling', 100);

            // Mirrors the production report: stale 35s, then PM 40, then 0.
            // Latest per side must win — not the oldest, not the average.
            // PM rows are independent (foreman_id NULL); the master-admin
            // row stays foreman-side.
            foreach ([
                [$foreman, 35, false],
                [$projectManager, 35, true],
                [$projectManager, 40, true],
                [$masterAdmin, 0, false],
            ] as [$submitter, $percent, $isPmRow]) {
                WeeklyAccomplishment::create([
                    'foreman_id' => $isPmRow ? null : $foreman->id,
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
            $this->seedScope($project, 'Column Footing', 50);
            $this->seedScope($project, 'Mobilization and Hauling', 50);

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

    public function test_variance_is_gap_between_progress_columns(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $projectManager = $this->makeUser('project_manager');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Partial Overlap Project', $headAdmin->id);
            $this->seedScope($project, 'Mobilization and Hauling', 50);
            $this->seedScope($project, 'Foundation Preparation', 50);

            // Foreman touches two scopes, PM reviews only one of them.
            // Sides keep their own weighted values (PM 14, foreman 26), and
            // variance is the gap between those columns: |14 - 26| = 12.
            foreach ([
                [$foreman, 'Mobilization and Hauling', 27, false],
                [$foreman, 'Foundation Preparation', 25, false],
                [$projectManager, 'Mobilization and Hauling', 28, true],
            ] as [$submitter, $scope, $percent, $isPmRow]) {
                WeeklyAccomplishment::create([
                    'foreman_id' => $isPmRow ? null : $foreman->id,
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
                    ->where('comparisonRows.0.variance', 12)
                    ->where('comparisonRows.0.status', 'Investigate'));

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments/' . $project->id)
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Show')
                    ->where('comparison.variance', 12)
                    ->where('comparison.status', 'Investigate')
                    ->has('scopeBreakdown', 2));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_adding_a_low_scope_never_drags_the_progress_down(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Monotonic Project', $headAdmin->id);
            $this->seedScope($project, 'Scope A', 50);
            $this->seedScope($project, 'Scope B', 30);
            $this->seedScope($project, 'Scope C', 20);

            // Unsubmitted scopes count as 0 over the weighted plan:
            // 27×50/100 + 25×30/100 = 21.
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
                    ->where('comparisonRows.0.foreman_progress', 21));

            // Submitting the remaining scope at 10 raises the weighted
            // progress to 23.
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
                    ->where('comparisonRows.0.foreman_progress', 23)
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

    public function test_project_without_submissions_still_appears_as_pending(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $foreman = $this->makeUser('foreman');
            $active = $this->makeProject('Active Project', $headAdmin->id);
            $this->seedScope($active, 'Column Footing', 100);
            $this->makeProject('Unassigned Project', $headAdmin->id);

            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'submitted_by' => $foreman->id,
                'project_id' => $active->id,
                'scope_of_work' => 'Column Footing',
                'percent_completed' => 40,
                'week_start' => '2026-08-17',
            ]);

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('comparisonRows', 2)
                    ->where('comparisonRows.0.project_name', 'Active Project')
                    ->where('comparisonRows.0.pm_progress', null)
                    ->where('comparisonRows.0.foreman_progress', 40)
                    ->where('comparisonRows.0.status', 'Pending')
                    ->where('comparisonRows.1.project_name', 'Unassigned Project')
                    ->where('comparisonRows.1.pm_progress', null)
                    ->where('comparisonRows.1.foreman_progress', null)
                    ->where('comparisonRows.1.variance', null)
                    ->where('comparisonRows.1.status', 'Pending')
                    ->where('overviewStats.total_projects', 2)
                    ->where('overviewStats.pending', 2));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_comparison_progress_uses_scope_weights_like_projects_kanban(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $projectManager = $this->makeUser('project_manager');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Weighted Residences', $headAdmin->id);

            // Planned scope plan with weights — the same source the
            // /projects kanban uses for its weighted overall progress.
            ProjectScope::create([
                'project_id' => $project->id,
                'scope_name' => 'Column Footing',
                'weight_percent' => 70,
            ]);
            ProjectScope::create([
                'project_id' => $project->id,
                'scope_name' => 'Masonry',
                'weight_percent' => 30,
            ]);

            WeeklyAccomplishment::create([
                'foreman_id' => null,
                'submitted_by' => $projectManager->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Column Footing',
                'percent_completed' => 100,
                'week_start' => '2026-08-17',
            ]);
            WeeklyAccomplishment::create([
                'foreman_id' => null,
                'submitted_by' => $projectManager->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Masonry',
                'percent_completed' => 50,
                'week_start' => '2026-08-17',
            ]);
            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'submitted_by' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Column Footing',
                'percent_completed' => 50,
                'week_start' => '2026-08-17',
            ]);

            // Weighted like the kanban (not a simple average over scopes):
            // PM = 70×100/100 + 30×50/100 = 85 (average would be 75),
            // Foreman = 70×50/100 + 30×0/100 = 35 (average would be 25).
            // Variance still uses the commonly-submitted scope: |100 − 50|.
            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('comparisonRows', 1)
                    ->where('comparisonRows.0.project_name', 'Weighted Residences')
                    ->where('comparisonRows.0.pm_progress', 85)
                    ->where('comparisonRows.0.foreman_progress', 35)
                    ->where('comparisonRows.0.variance', 50)
                    ->where('comparisonRows.0.status', 'Investigate'));

            // The detail page shares the same comparison payload.
            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments/' . $project->id)
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Show')
                    ->where('comparison.pm_progress', 85)
                    ->where('comparison.foreman_progress', 35));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_comparison_progress_is_zero_without_scope_weights(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $projectManager = $this->makeUser('project_manager');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Unweighted Residences', $headAdmin->id);

            // Planned scopes but no weights — exactly like /projects, which
            // reads 0 when the plan carries no weights.
            $this->seedScope($project, 'Column Footing');
            $this->seedScope($project, 'Masonry');

            WeeklyAccomplishment::create([
                'foreman_id' => null,
                'submitted_by' => $projectManager->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Column Footing',
                'percent_completed' => 100,
                'week_start' => '2026-08-17',
            ]);
            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'submitted_by' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Column Footing',
                'percent_completed' => 50,
                'week_start' => '2026-08-17',
            ]);

            // No usable weights: both columns read 0 even with submissions,
            // so the gap between them is 0 as well.
            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('comparisonRows', 1)
                    ->where('comparisonRows.0.pm_progress', 0)
                    ->where('comparisonRows.0.foreman_progress', 0)
                    ->where('comparisonRows.0.variance', 0)
                    ->where('comparisonRows.0.status', 'On Track'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_detail_overall_progress_equals_pm_progress(): void
    {
        Carbon::setTestNow('2026-08-18 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $projectManager = $this->makeUser('project_manager');
            $foreman = $this->makeUser('foreman');
            // Column snapshot is 62 via makeProject — the detail Overview
            // must ignore it and read the PM progress instead.
            $project = $this->makeProject('Kanban Parity Residences', $headAdmin->id);
            ProjectScope::create([
                'project_id' => $project->id,
                'scope_name' => 'Column Footing',
                'weight_percent' => 70,
                'progress_percent' => 50,
            ]);
            ProjectScope::create([
                'project_id' => $project->id,
                'scope_name' => 'Masonry',
                'weight_percent' => 30,
                'progress_percent' => 100,
            ]);

            $this->seedPair($projectManager, $foreman, $project, 62, 55);

            // PM-weighted: 70×62/100 = 43.4 (Masonry unsubmitted counts 0).
            // Overview Overall equals that same PM number.
            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments/' . $project->id)
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Show')
                    ->where('comparison.overall_progress', 43.4)
                    ->where('comparison.pm_progress', 43.4)
                    ->where('comparison.foreman_progress', 38.5));
        } finally {
            Carbon::setTestNow();
        }
    }

    private function seedScope(Project $project, string $scope, ?float $weight = null): void
    {
        ProjectScope::create(array_filter([
            'project_id' => $project->id,
            'scope_name' => $scope,
            'weight_percent' => $weight,
        ], fn ($value) => $value !== null));
    }

    private function seedPair(User $projectManager, User $foreman, Project $project, float $pm, float $foremanPercent): void
    {
        // PM side is independent rows (foreman_id NULL); foreman side keeps
        // the foreman_id. Historical PM rows stored under a foreman are
        // frozen and ignored by both sides.
        WeeklyAccomplishment::create([
            'foreman_id' => null,
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
