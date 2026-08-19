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

class WeeklyAccomplishmentsFiltersTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_filter_limits_results(): void
    {
        [$headAdmin, $projectA] = $this->seedData();

        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments?project_id=' . $projectA->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('weeklyAccomplishments', 2)
                ->where('weeklyAccomplishmentTable.project_id', (string) $projectA->id));
    }

    public function test_foreman_filter_limits_results(): void
    {
        [$headAdmin, , $foremanA] = $this->seedData();

        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments?foreman_id=' . $foremanA->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('weeklyAccomplishments', 2)
                ->where('weeklyAccomplishmentTable.foreman_id', (string) $foremanA->id));
    }

    public function test_week_range_filter_limits_results(): void
    {
        [$headAdmin] = $this->seedData();

        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('weeklyAccomplishments', 2));
    }

    public function test_submission_date_range_filter_limits_results(): void
    {
        [$headAdmin] = $this->seedData();

        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments?date_from=2026-08-18&date_to=2026-08-18')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('weeklyAccomplishments', 2));
    }

    public function test_head_admin_week_buckets_are_paginated_five_per_page(): void
    {
        // Pin the clock to the last seeded week so auto-generated placeholder
        // weeks do not extend the timeline beyond the 7 real submissions.
        Carbon::setTestNow('2026-07-13 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Paginated Project');

            $weeks = ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29', '2026-07-06', '2026-07-13'];
            foreach ($weeks as $index => $weekStart) {
                $scopeName = 'Scope ' . ($index + 1);
                $projectScope = ProjectScope::create([
                    'project_id' => $project->id,
                    'scope_name' => $scopeName,
                ]);
                WeeklyAccomplishment::create([
                    'foreman_id' => $foreman->id,
                    'project_id' => $project->id,
                    'scope_of_work' => $scopeName,
                    'percent_completed' => 10 * ($index + 1),
                    'week_start' => $weekStart,
                ]);

                ScopePhoto::create([
                    'project_scope_id' => $projectScope->id,
                    'photo_path' => 'test-paginated-' . ($index + 1) . '.jpg',
                    'caption' => 'Week: ' . $weekStart,
                ]);
            }

            // 7 week buckets -> page 1 shows 5, page 2 shows the remaining 2.
            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?per_page=5')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('weeklyAccomplishments', 5)
                    ->where('weeklyAccomplishmentTable.per_page', 5)
                    ->where('weeklyAccomplishmentTable.current_page', 1)
                    ->where('weeklyAccomplishmentTable.last_page', 2)
                    ->where('weeklyAccomplishmentTable.total', 7));

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?per_page=5&page=2')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('weeklyAccomplishments', 2)
                    ->where('weeklyAccomplishmentTable.current_page', 2));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_only_edited_scopes_are_shown_for_a_week(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Edited Scopes Project');

        $weekStart = '2026-10-12';

        // One scope gets its progress percent updated after seeding.
        $edited = WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Mobilization and Hauling',
            'percent_completed' => 32,
            'week_start' => $weekStart,
            'is_placeholder' => true,
        ]);
        WeeklyAccomplishment::where('id', $edited->id)->update([
            'created_at' => '2026-10-14 13:26:42',
            'updated_at' => '2026-10-14 13:27:07',
        ]);

        // One scope gets a photo uploaded for that week (row itself untouched).
        $withPhoto = WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Foundation Preparation',
            'percent_completed' => 50,
            'week_start' => $weekStart,
            'is_placeholder' => true,
        ]);
        WeeklyAccomplishment::where('id', $withPhoto->id)->update([
            'created_at' => '2026-10-14 13:26:42',
            'updated_at' => '2026-10-14 13:26:42',
        ]);

        // The remaining seeded placeholder scopes are never touched.
        $placeholderOne = WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Column Footing',
            'percent_completed' => 67,
            'week_start' => $weekStart,
            'is_placeholder' => true,
        ]);
        WeeklyAccomplishment::where('id', $placeholderOne->id)->update([
            'created_at' => '2026-10-14 13:26:42',
            'updated_at' => '2026-10-14 13:26:42',
        ]);
        $placeholderTwo = WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Painting Works',
            'percent_completed' => 11,
            'week_start' => $weekStart,
            'is_placeholder' => true,
        ]);
        WeeklyAccomplishment::where('id', $placeholderTwo->id)->update([
            'created_at' => '2026-10-14 13:26:43',
            'updated_at' => '2026-10-14 13:26:43',
        ]);

        $scopesByName = collect(['Mobilization and Hauling', 'Foundation Preparation', 'Column Footing', 'Painting Works'])
            ->mapWithKeys(function (string $name) use ($project) {
                $scope = ProjectScope::create([
                    'project_id' => $project->id,
                    'scope_name' => $name,
                ]);

                return [$name => $scope];
            });

        ScopePhoto::create([
            'project_scope_id' => $scopesByName['Foundation Preparation']->id,
            'photo_path' => 'foundation-week-1012.jpg',
            'caption' => '[Jotform Weekly] | Week: ' . $weekStart . ' | Scope: Foundation Preparation',
            'created_at' => '2026-10-14 13:27:09',
        ]);

        $response = $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments?week_from=' . $weekStart . '&week_to=2026-10-18');

        $response->assertInertia(fn ($page) => $page
            ->component('HeadAdmin/WeeklyAccomplishments/Index')
            ->has('weeklyAccomplishments', 2)
            ->where('weeklyAccomplishments.0.scope_of_work', $edited->scope_of_work)
            ->where('weeklyAccomplishments.1.scope_of_work', $withPhoto->scope_of_work));
    }

    public function test_head_admin_shows_auto_generated_empty_week_tabs(): void
    {
        [$headAdmin] = $this->seedGapScenario('head_admin');

        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('projects', 3)
                ->has('weeklyAccomplishments', 2)
                ->where('weeklyAccomplishmentTable.total', 3)
                ->where('projects.1.name', 'Week of Oct 19, 2026 - Oct 25, 2026 — Gap Scenario Project'));
    }

    public function test_master_admin_shows_auto_generated_empty_week_tabs(): void
    {
        [$masterAdmin] = $this->seedGapScenario('master_admin');

        $this->actingAs($masterAdmin)
            ->get('/weekly-accomplishments')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('projects', 3)
                ->has('weeklyAccomplishments', 2)
                ->where('weeklyAccomplishmentTable.total', 3)
                ->where('projects.1.name', 'Week of Oct 19, 2026 - Oct 25, 2026 — Gap Scenario Project'));
    }

    public function test_admin_shows_auto_generated_empty_week_tabs(): void
    {
        [$admin] = $this->seedGapScenario('admin');

        $this->actingAs($admin)
            ->get('/weekly-accomplishments')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('projects', 3)
                ->has('weeklyAccomplishments', 2)
                ->where('weeklyAccomplishmentTable.total', 3)
                ->where('projects.1.name', 'Week of Oct 19, 2026 - Oct 25, 2026 — Gap Scenario Project'));
    }

    public function test_browsing_weekly_accomplishments_generates_skipped_weeks_to_current(): void
    {
        Carbon::setTestNow('2026-08-31 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Skipped Weeks Project');

            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Excavation',
                'percent_completed' => 40,
                'week_start' => '2026-08-03',
            ]);
            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Excavation',
                'percent_completed' => 60,
                'week_start' => '2026-08-24',
            ]);
            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Roofing',
                'percent_completed' => 20,
                'week_start' => '2026-08-24',
            ]);

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments')
                ->assertOk();

            $rows = WeeklyAccomplishment::query()
                ->where('foreman_id', $foreman->id)
                ->where('project_id', $project->id)
                ->orderBy('week_start')
                ->orderBy('scope_of_work')
                ->get(['week_start', 'scope_of_work', 'percent_completed'])
                ->map(fn ($row) => [
                    'week' => Carbon::parse($row->week_start)->toDateString(),
                    'scope' => $row->scope_of_work,
                    'percent' => (float) $row->percent_completed,
                ])
                ->values()
                ->all();

            $this->assertSame([
                ['week' => '2026-08-03', 'scope' => 'Excavation', 'percent' => 40.0],
                ['week' => '2026-08-10', 'scope' => 'Excavation', 'percent' => 40.0],
                ['week' => '2026-08-17', 'scope' => 'Excavation', 'percent' => 40.0],
                ['week' => '2026-08-24', 'scope' => 'Excavation', 'percent' => 60.0],
                ['week' => '2026-08-24', 'scope' => 'Roofing', 'percent' => 20.0],
                ['week' => '2026-08-31', 'scope' => 'Excavation', 'percent' => 60.0],
                ['week' => '2026-08-31', 'scope' => 'Roofing', 'percent' => 20.0],
            ], $rows);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_fresh_submission_on_new_project_is_visible(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Fresh Submission Project');

        $row = WeeklyAccomplishment::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Excavation',
            'percent_completed' => 35,
            'week_start' => '2026-08-17',
        ]);
        // A brand-new project has no seeded templates, so the first jotform
        // submission creates a row with identical created/updated timestamps and
        // no photo. It must still surface on the page.
        WeeklyAccomplishment::where('id', $row->id)->update([
            'created_at' => '2026-08-17 10:00:00',
            'updated_at' => '2026-08-17 10:00:00',
        ]);

        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments?week_from=2026-08-17&week_to=2026-08-23')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('weeklyAccomplishments', 1)
                ->where('weeklyAccomplishments.0.scope_of_work', 'Excavation')
                ->where('weeklyAccomplishments.0.percent_completed', '35.00'));
    }

    public function test_combined_filters_narrow_results_further(): void
    {
        [$headAdmin, $projectA, $foremanA] = $this->seedData();

        // Foreman A has rows only on project A, so combining both still returns 2.
        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments?project_id=' . $projectA->id . '&foreman_id=' . $foremanA->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('weeklyAccomplishments', 2));

        // Foreman B has no rows on project A, so the combination returns nothing.
        $foremanB = User::where('role', 'foreman')->where('id', '!=', $foremanA->id)->firstOrFail();
        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments?project_id=' . $projectA->id . '&foreman_id=' . $foremanB->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Index')
                ->has('weeklyAccomplishments', 0));
    }

    public function test_head_admin_generates_weeks_after_last_submission_to_current(): void
    {
        // Today is Sep 1 (Tuesday) -> current week starts Aug 31. A project with
        // only an Aug 17 submission must still get Aug 24 and Aug 31 tabs.
        Carbon::setTestNow('2026-09-01 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Timeline Project');

            $row = WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Excavation',
                'percent_completed' => 40,
                'week_start' => '2026-08-17',
            ]);
            WeeklyAccomplishment::where('id', $row->id)->update([
                'created_at' => '2026-08-18 10:00:00',
                'updated_at' => '2026-08-18 10:00:00',
            ]);

            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->has('weeklyAccomplishments', 1)
                    ->where('weeklyAccomplishmentTable.total', 3)
                    ->where('projects.0.name', 'Week of Aug 31, 2026 - Sep 6, 2026 — Timeline Project')
                    ->where('projects.1.name', 'Week of Aug 24, 2026 - Aug 30, 2026 — Timeline Project')
                    ->where('projects.2.name', 'Week of Aug 17, 2026 - Aug 23, 2026 — Timeline Project'));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_head_admin_week_filter_matches_the_week_containing_the_date(): void
    {
        Carbon::setTestNow('2026-09-01 12:00:00');

        try {
            $headAdmin = $this->makeUser('head_admin');
            $foreman = $this->makeUser('foreman');
            $project = $this->makeProject('Timeline Project');

            WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Excavation',
                'percent_completed' => 40,
                'week_start' => '2026-08-17',
            ]);

            // Filtering from a mid-week date (Sep 1) must still surface the
            // Aug 31 - Sep 6 week bucket that contains it.
            $this->actingAs($headAdmin)
                ->get('/weekly-accomplishments?week_from=2026-09-01')
                ->assertOk()
                ->assertInertia(fn ($page) => $page
                    ->component('HeadAdmin/WeeklyAccomplishments/Index')
                    ->where('weeklyAccomplishmentTable.total', 1)
                    ->where('projects.0.name', 'Week of Aug 31, 2026 - Sep 6, 2026 — Timeline Project'));
        } finally {
            Carbon::setTestNow();
        }
    }

    private function seedData(): array
    {
        $headAdmin = $this->makeUser('head_admin');
        $foremanA = $this->makeUser('foreman');
        $foremanB = $this->makeUser('foreman');

        $projectA = $this->makeProject('Filter Project A');
        $projectB = $this->makeProject('Filter Project B');

        $first = WeeklyAccomplishment::create([
            'foreman_id' => $foremanA->id,
            'project_id' => $projectA->id,
            'scope_of_work' => 'Excavation',
            'percent_completed' => 40,
            'week_start' => '2026-08-10',
        ]);
        $second = WeeklyAccomplishment::create([
            'foreman_id' => $foremanA->id,
            'project_id' => $projectA->id,
            'scope_of_work' => 'Excavation',
            'percent_completed' => 60,
            'week_start' => '2026-08-17',
        ]);
        $third = WeeklyAccomplishment::create([
            'foreman_id' => $foremanB->id,
            'project_id' => $projectB->id,
            'scope_of_work' => 'Roofing',
            'percent_completed' => 20,
            'week_start' => '2026-08-17',
        ]);

        // Deterministic timestamps so date-range filtering is stable regardless of run time.
        WeeklyAccomplishment::where('id', $first->id)->update([
            'created_at' => '2026-08-12 10:00:00',
            'updated_at' => '2026-08-12 10:00:00',
        ]);
        WeeklyAccomplishment::where('id', $second->id)->update([
            'created_at' => '2026-08-18 10:00:00',
            'updated_at' => '2026-08-18 10:00:00',
        ]);
        WeeklyAccomplishment::where('id', $third->id)->update([
            'created_at' => '2026-08-18 11:00:00',
            'updated_at' => '2026-08-18 11:00:00',
        ]);

        $scopeA = ProjectScope::create([
            'project_id' => $projectA->id,
            'scope_name' => 'Excavation',
        ]);
        $scopeB = ProjectScope::create([
            'project_id' => $projectB->id,
            'scope_name' => 'Roofing',
        ]);

        ScopePhoto::create([
            'project_scope_id' => $scopeA->id,
            'photo_path' => 'test-a-1.jpg',
            'caption' => 'Week: 2026-08-10',
            'created_at' => '2026-08-12 10:00:00',
        ]);
        ScopePhoto::create([
            'project_scope_id' => $scopeA->id,
            'photo_path' => 'test-a-2.jpg',
            'caption' => 'Week: 2026-08-17',
            'created_at' => '2026-08-18 10:00:00',
        ]);
        ScopePhoto::create([
            'project_scope_id' => $scopeB->id,
            'photo_path' => 'test-b-1.jpg',
            'caption' => 'Week: 2026-08-17',
            'created_at' => '2026-08-18 11:00:00',
        ]);

        return [$headAdmin, $projectA, $foremanA];
    }

    private function seedGapScenario(string $role = 'head_admin'): array
    {
        $user = $this->makeUser($role);
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('Gap Scenario Project');

        foreach (['2026-10-12' => 40, '2026-10-26' => 60] as $weekStart => $percent) {
            $row = WeeklyAccomplishment::create([
                'foreman_id' => $foreman->id,
                'project_id' => $project->id,
                'scope_of_work' => 'Excavation',
                'percent_completed' => $percent,
                'week_start' => $weekStart,
            ]);
            WeeklyAccomplishment::where('id', $row->id)->update([
                'created_at' => $weekStart . ' 09:00:00',
                'updated_at' => $weekStart . ' 14:30:00',
            ]);
        }

        return [$user, $foreman, $project];
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

    private function makeProject(string $name): Project
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
        ]);
    }
}
