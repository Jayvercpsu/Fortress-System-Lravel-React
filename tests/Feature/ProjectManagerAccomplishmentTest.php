<?php

namespace Tests\Feature;

use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProjectManagerAccomplishmentTest extends TestCase
{
    use RefreshDatabase;

    private User $projectManager;

    private User $foreman;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->projectManager = $this->makeUser('project_manager');
        $this->foreman = $this->makeUser('foreman');

        $this->project = Project::create([
            'name' => 'PM Accomplishment Project',
            'client' => 'PM Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => $this->foreman->fullname,
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
        ]);
    }

    public function test_project_manager_can_view_accomplishment_page_with_construction_projects_only(): void
    {
        Project::create([
            'name' => 'Design Only Project',
            'client' => 'Design Client',
            'type' => 'Residential',
            'location' => 'Makati',
            'assigned' => $this->foreman->fullname,
            'status' => 'ACTIVE',
            'phase' => 'Design',
            'overall_progress' => 10,
        ]);

        $this->actingAs($this->projectManager)
            ->get('/project-manager/accomplishments')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                ->where('selectedProjectId', $this->project->id)
                ->where('selectedProjectName', 'PM Accomplishment Project')
                ->where('selectedForemanId', $this->foreman->id)
                ->where('selectedForemanName', $this->foreman->fullname)
                ->where('projects', fn ($projects) => $projects->count() === 1
                    && (int) $projects[0]['id'] === (int) $this->project->id
                    && $projects[0]['phase'] === 'Construction')
                ->has('foremen', 1)
                ->has('weekly')
                ->has('jotformLink'));
    }

    public function test_project_manager_can_save_accomplishment_under_the_project_foreman(): void
    {
        $weekStart = Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();

        $response = $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'foreman_id' => $this->foreman->id,
                'week_start' => $weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 45],
                ],
            ]);

        $response->assertRedirect(route('project_manager.accomplishments', [
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
        ]));

        $this->assertDatabaseHas('weekly_accomplishments', [
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
            'week_start' => $weekStart . ' 00:00:00',
            'scope_of_work' => 'Slab on Fill',
            'percent_completed' => 45,
            'is_placeholder' => false,
        ]);

        // Overall project progress is recomputed from the weekly rows (45% average).
        $this->assertDatabaseHas('projects', [
            'id' => $this->project->id,
            'overall_progress' => 45,
        ]);
    }

    public function test_pm_saved_accomplishment_appears_in_the_foreman_jotform(): void
    {
        $weekStart = Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'foreman_id' => $this->foreman->id,
                'week_start' => $weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 45],
                ],
            ])
            ->assertRedirect();

        $token = ProgressSubmitToken::create([
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
            'token' => 'pm-accomplishment-sync-token',
        ]);

        $this->get('/progress-submit/' . $token->token)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/ProgressSubmit')
                ->where('submitToken.weekly_saved_by_week', fn ($byWeek) => collect($byWeek[$weekStart] ?? [])
                    ->contains(fn ($row) => ($row['scope_of_work'] ?? '') === 'Slab on Fill'
                        && (float) ($row['percent_completed'] ?? 0) === 45.0)));
    }

    public function test_foreman_jotform_edit_reflects_on_the_pm_accomplishment_page(): void
    {
        $token = ProgressSubmitToken::create([
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
            'token' => 'foreman-jotform-edit-token',
        ]);

        $weekStart = Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();

        $this->post('/progress-submit/' . $token->token . '/weekly-progress', [
            'week_start' => $weekStart,
            'scopes' => [
                ['scope_of_work' => 'Column', 'percent_completed' => 62],
            ],
        ])->assertRedirect();

        $this->actingAs($this->projectManager)
            ->get('/project-manager/accomplishments?project_id=' . $this->project->id . '&foreman_id=' . $this->foreman->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                ->where('weekly.weekly_saved_by_week', fn ($byWeek) => collect($byWeek[$weekStart] ?? [])
                    ->contains(fn ($row) => ($row['scope_of_work'] ?? '') === 'Column'
                        && (float) ($row['percent_completed'] ?? 0) === 62.0)));
    }

    public function test_pm_cannot_save_accomplishment_for_non_construction_project(): void
    {
        $designProject = Project::create([
            'name' => 'Design Phase Project',
            'client' => 'Design Client',
            'type' => 'Residential',
            'location' => 'Makati',
            'assigned' => $this->foreman->fullname,
            'status' => 'ACTIVE',
            'phase' => 'Design',
            'overall_progress' => 0,
        ]);

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $designProject->id,
                'foreman_id' => $this->foreman->id,
                'week_start' => Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString(),
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 10],
                ],
            ])
            ->assertStatus(422);

        $this->assertDatabaseCount('weekly_accomplishments', 0);
    }

    public function test_pm_cannot_save_accomplishment_for_foreman_not_assigned_to_the_project(): void
    {
        $otherForeman = $this->makeUser('foreman');

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'foreman_id' => $otherForeman->id,
                'week_start' => Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString(),
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 10],
                ],
            ])
            ->assertStatus(422);

        $this->assertDatabaseCount('weekly_accomplishments', 0);
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