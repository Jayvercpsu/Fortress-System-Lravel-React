<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

        return [$headAdmin, $projectA, $foremanA];
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
