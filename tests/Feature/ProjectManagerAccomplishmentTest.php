<?php

namespace Tests\Feature;

use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
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

        ProjectAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->projectManager->id,
            'role_in_project' => ProjectAssignment::ROLE_PROJECT_MANAGER,
        ]);
    }

    private function weekStart(): string
    {
        return Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    public function test_project_manager_lists_only_assigned_construction_projects(): void
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
        $otherProject = Project::create([
            'name' => 'Other PM Project',
            'client' => 'Other Client',
            'type' => 'Residential',
            'location' => 'Makati',
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
        ]);

        $this->actingAs($this->projectManager)
            ->get('/project-manager/accomplishments')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                ->where('selectedProjectId', $this->project->id)
                ->where('selectedProjectName', 'PM Accomplishment Project')
                ->where('projects', fn ($projects) => $projects->count() === 1
                    && (int) $projects[0]['id'] === (int) $this->project->id
                    && $projects[0]['phase'] === 'Construction')
                ->where('selectedWeek', $this->weekStart())
                ->has('planScopes')
                ->has('savedScopes'));
    }

    public function test_project_manager_saves_independent_accomplishment(): void
    {
        $weekStart = $this->weekStart();

        $response = $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 45],
                ],
            ]);

        $response->assertRedirect(route('project_manager.accomplishments', [
            'project_id' => $this->project->id,
            'week_start' => $weekStart,
        ]));

        // Independent PM row: no foreman attached.
        $this->assertDatabaseHas('weekly_accomplishments', [
            'project_id' => $this->project->id,
            'foreman_id' => null,
            'submitted_by' => $this->projectManager->id,
            'week_start' => $weekStart . ' 00:00:00',
            'scope_of_work' => 'Slab on Fill',
            'percent_completed' => 45,
            'is_placeholder' => false,
        ]);

        // Separation: neither the project snapshot nor the shared scope
        // plan progress may move because of a PM save.
        $this->assertDatabaseHas('projects', [
            'id' => $this->project->id,
            'overall_progress' => 0,
        ]);
    }

    public function test_pm_save_does_not_appear_in_foreman_jotform(): void
    {
        $weekStart = $this->weekStart();

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
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
                ->where('submitToken.weekly_saved_by_week', fn ($byWeek) => !collect($byWeek[$weekStart] ?? [])
                    ->contains(fn ($row) => ($row['scope_of_work'] ?? '') === 'Slab on Fill'
                        && (float) ($row['percent_completed'] ?? 0) === 45.0)));
    }

    public function test_foreman_jotform_edit_does_not_appear_on_pm_page(): void
    {
        $token = ProgressSubmitToken::create([
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
            'token' => 'foreman-jotform-edit-token',
        ]);

        $weekStart = $this->weekStart();

        $this->post('/progress-submit/' . $token->token . '/weekly-progress', [
            'week_start' => $weekStart,
            'scopes' => [
                ['scope_of_work' => 'Column', 'percent_completed' => 62],
            ],
        ])->assertRedirect();

        // The PM grid only ever shows the PM's own saved scopes.
        $this->actingAs($this->projectManager)
            ->get('/project-manager/accomplishments?project_id=' . $this->project->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                ->where('savedScopes', fn ($scopes) => $scopes->isEmpty()));
    }

    public function test_pm_page_exposes_foreman_compare_data(): void
    {
        $token = ProgressSubmitToken::create([
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
            'token' => 'foreman-compare-data-token',
        ]);

        $weekStart = $this->weekStart();

        $this->post('/progress-submit/' . $token->token . '/weekly-progress', [
            'week_start' => $weekStart,
            'scopes' => [
                ['scope_of_work' => 'Column', 'percent_completed' => 62],
            ],
        ])->assertRedirect();

        // The PM grid stays foreman-free, but the Compare view receives the
        // foreman's latest row for the week with the foreman's name.
        $this->actingAs($this->projectManager)
            ->get('/project-manager/accomplishments?project_id=' . $this->project->id . '&week_start=' . $weekStart)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                ->where('savedScopes', fn ($scopes) => $scopes->isEmpty())
                ->has('foremanScopes', 1)
                ->where('foremanScopes.0.scope_of_work', 'Column')
                ->where('foremanScopes.0.percent_completed', 62)
                ->where('foremanScopes.0.foreman_name', $this->foreman->fullname)
                ->has('assignedForemen'));
    }

    public function test_pm_save_returns_saved_scopes_and_progress(): void
    {
        $weekStart = $this->weekStart();

        ProjectScope::create([
            'project_id' => $this->project->id,
            'scope_name' => 'Slab on Fill',
            'weight_percent' => 100,
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
        ]);

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 45],
                ],
            ])
            ->assertRedirect();

        $this->actingAs($this->projectManager)
            ->get('/project-manager/accomplishments?project_id=' . $this->project->id . '&week_start=' . $weekStart)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                ->where('savedScopes.0.scope_of_work', 'Slab on Fill')
                ->where('savedScopes.0.percent_completed', 45)
                ->where('pmProgress', 45));
    }

    public function test_project_manager_can_save_scope_photos_without_touching_plan_progress(): void
    {
        Storage::fake('public');
        $weekStart = $this->weekStart();

        ProjectScope::create([
            'project_id' => $this->project->id,
            'scope_name' => 'Slab on Fill',
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
            'assigned_personnel' => $this->foreman->fullname,
        ]);

        $photo = UploadedFile::fake()->image('scope-proof.jpg');

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $weekStart,
                'scopes' => [
                    [
                        'scope_of_work' => 'Slab on Fill',
                        'percent_completed' => 45,
                        'photo_caption' => 'Slab poured',
                        'photos' => [$photo],
                    ],
                ],
            ])
            ->assertRedirect();

        $scope = ProjectScope::query()
            ->where('project_id', $this->project->id)
            ->where('scope_name', 'Slab on Fill')
            ->firstOrFail();

        $this->assertDatabaseHas('scope_photos', [
            'project_scope_id' => $scope->id,
        ]);
        $this->assertSame(1, $scope->photos()->count());

        // Plan progress stays foreman-driven.
        $this->assertSame(0, (int) $scope->refresh()->progress_percent);

        // The uploaded photo surfaces in the PM grid's own photo map.
        $this->actingAs($this->projectManager)
            ->get('/project-manager/accomplishments?project_id=' . $this->project->id . '&week_start=' . $weekStart)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                ->where('scopePhotoMap.slab on fill.0.week_start', $weekStart)
                ->has('scopePhotoMap.slab on fill', 1));
    }

    public function test_pm_grid_hides_foreman_scope_photos(): void
    {
        $weekStart = $this->weekStart();

        $scope = ProjectScope::create([
            'project_id' => $this->project->id,
            'scope_name' => 'Slab on Fill',
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
            'assigned_personnel' => $this->foreman->fullname,
        ]);

        \App\Models\ScopePhoto::create([
            'project_scope_id' => $scope->id,
            'photo_path' => 'scope-photos/foreman-hidden.jpg',
            'caption' => '[Jotform Weekly] | Week: ' . $weekStart . ' | Scope: Slab on Fill',
        ]);

        // Foreman uploads never leak into the PM grid's photo map.
        $this->actingAs($this->projectManager)
            ->get('/project-manager/accomplishments?project_id=' . $this->project->id . '&week_start=' . $weekStart)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                ->where('scopePhotoMap', fn ($map) => !isset($map['slab on fill'])));
    }

    public function test_pm_photos_persist_when_percent_is_unchanged(): void
    {
        Storage::fake('public');
        $weekStart = $this->weekStart();

        ProjectScope::create([
            'project_id' => $this->project->id,
            'scope_name' => 'Slab on Fill',
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
            'assigned_personnel' => $this->foreman->fullname,
        ]);

        // First save carries the percent with no photos.
        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 45],
                ],
            ])
            ->assertRedirect();

        // Re-saving the same percent with photos must still store them —
        // the dedup only skips the duplicate history row.
        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $weekStart,
                'scopes' => [
                    [
                        'scope_of_work' => 'Slab on Fill',
                        'percent_completed' => 45,
                        'photo_caption' => 'Second visit',
                        'photos' => [UploadedFile::fake()->image('again.jpg')],
                    ],
                ],
            ])
            ->assertRedirect();

        $this->assertSame(1, \App\Models\ScopePhoto::query()->count());
        $this->assertSame(1, \App\Models\WeeklyAccomplishment::query()
            ->where('project_id', $this->project->id)
            ->whereNull('foreman_id')
            ->count());
    }

    public function test_pm_can_delete_own_scope_photo(): void
    {
        Storage::fake('public');
        $weekStart = $this->weekStart();

        $scope = ProjectScope::create([
            'project_id' => $this->project->id,
            'scope_name' => 'Slab on Fill',
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
            'assigned_personnel' => $this->foreman->fullname,
        ]);

        $photo = \App\Models\ScopePhoto::create([
            'project_scope_id' => $scope->id,
            'photo_path' => 'scope-photos/pm-delete-test.jpg',
            'caption' => '[PM Weekly] | Week: ' . $weekStart . ' | Scope: Slab on Fill',
        ]);

        $this->actingAs($this->projectManager)
            ->delete('/project-manager/scope-photos/' . $photo->id)
            ->assertRedirect();

        $this->assertSoftDeleted('scope_photos', ['id' => $photo->id]);
    }

    public function test_pm_cannot_delete_foreman_scope_photo(): void
    {
        Storage::fake('public');

        $scope = ProjectScope::create([
            'project_id' => $this->project->id,
            'scope_name' => 'Slab on Fill',
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
            'assigned_personnel' => $this->foreman->fullname,
        ]);

        $photo = \App\Models\ScopePhoto::create([
            'project_scope_id' => $scope->id,
            'photo_path' => 'scope-photos/foreman-keep-test.jpg',
            'caption' => '[Jotform Weekly] | Week: ' . $this->weekStart() . ' | Scope: Slab on Fill',
        ]);

        $this->actingAs($this->projectManager)
            ->delete('/project-manager/scope-photos/' . $photo->id)
            ->assertNotFound();

        $this->assertDatabaseHas('scope_photos', ['id' => $photo->id]);
    }

    public function test_pm_can_remove_a_saved_scope(): void
    {
        $weekStart = $this->weekStart();

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $weekStart,
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 45],
                ],
            ])
            ->assertRedirect();

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $weekStart,
                'scopes' => [],
                'removed_scopes' => ['Slab on Fill'],
            ])
            ->assertRedirect();

        // Soft-deleted, so invisible to the PM grid (Eloquent excludes trashed rows).
        $this->assertSame(0, WeeklyAccomplishment::query()->count());
        $this->assertSame(1, WeeklyAccomplishment::withTrashed()->count());
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
                'week_start' => $this->weekStart(),
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 10],
                ],
            ])
            ->assertStatus(422);

        $this->assertDatabaseCount('weekly_accomplishments', 0);
    }

    public function test_pm_cannot_save_accomplishment_for_unassigned_project(): void
    {
        $otherProject = Project::create([
            'name' => 'Unassigned Project',
            'client' => 'Other Client',
            'type' => 'Residential',
            'location' => 'Makati',
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
        ]);

        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $otherProject->id,
                'week_start' => $this->weekStart(),
                'scopes' => [
                    ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 10],
                ],
            ])
            ->assertForbidden();

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
