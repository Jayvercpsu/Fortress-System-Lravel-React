<?php

namespace Tests\Feature;

use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Regression test for the weekly-grid display rule:
 *
 * - A scope assigned to the foreman is PERMANENTLY displayed (edited or
 *   not, even at null/0) on the public jotform, the project-manager
 *   accomplishments page, and the foreman mobile API.
 * - A scope NOT assigned to the foreman is never listed.
 */
class WeeklyScopePersistenceTest extends TestCase
{
    use RefreshDatabase;

    private User $foreman;

    private User $projectManager;

    private Project $project;

    /** @var string[] */
    private array $scopeNames = [
        'Scope Alpha',
        'Scope Beta',
        'Scope Gamma',
        'Scope Delta',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->foreman = User::create([
            'fullname' => 'Persistence Foreman',
            'email' => 'persistence.foreman@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $this->projectManager = User::create([
            'fullname' => 'Persistence PM',
            'email' => 'persistence.pm@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $this->project = Project::create([
            'name' => 'Persistence Project',
            'client' => 'Persistence Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'Construction',
            'overall_progress' => 0,
        ]);

        ProjectAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->foreman->id,
            'role_in_project' => 'foreman',
        ]);
    }

    private function seedScopes(?string $assignee): void
    {
        foreach ($this->scopeNames as $index => $name) {
            ProjectScope::create([
                'project_id' => $this->project->id,
                'scope_name' => $name,
                'progress_percent' => 0,
                'status' => 'NOT_STARTED',
                'assigned_personnel' => $assignee,
                'sort_order' => $index + 1,
            ]);
        }
    }

    private function monday(): string
    {
        return Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    private function foremanToken(): string
    {
        return (string) $this->postJson('/api/foreman/login', [
            'email' => 'persistence.foreman@example.test',
            'password' => 'password123',
        ])->json('token');
    }

    private function submitToken(): ProgressSubmitToken
    {
        return ProgressSubmitToken::create([
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
            'token' => 'persistence-token',
        ]);
    }

    public function test_mobile_jotform_permanently_lists_assigned_scopes_after_partial_submit(): void
    {
        $this->seedScopes('Persistence Foreman');

        $headers = ['Authorization' => 'Bearer '.$this->foremanToken(), 'Accept' => 'application/json'];

        // Edit only one of the four scopes.
        $this->post("/api/foreman/projects/{$this->project->id}/submit-all", [
            'weekly_week_start' => $this->monday(),
            'weekly_scopes' => [
                ['scope_of_work' => 'Scope Alpha', 'percent_completed' => 40],
            ],
        ], $headers)->assertOk();

        $payload = $this->getJson("/api/foreman/projects/{$this->project->id}/jotform", $headers)
            ->assertOk()
            ->json();

        $this->assertEqualsCanonicalizing(
            $this->scopeNames,
            array_column($payload['scopes'], 'scope_name'),
            'An assigned scope vanished from the mobile jotform payload.'
        );
    }

    public function test_mobile_jotform_hides_scopes_not_assigned_to_the_foreman(): void
    {
        $this->seedScopes('Some Other Foreman');

        $headers = ['Authorization' => 'Bearer '.$this->foremanToken(), 'Accept' => 'application/json'];

        $payload = $this->getJson("/api/foreman/projects/{$this->project->id}/jotform", $headers)
            ->assertOk()
            ->json();

        $this->assertSame([], $payload['scopes']);
    }

    public function test_project_creation_seeds_assigned_default_scopes_for_construction(): void
    {
        $headAdmin = User::create([
            'fullname' => 'Seed Head Admin',
            'email' => 'seed.head.admin@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_HEAD_ADMIN,
        ]);
        $pm = User::create([
            'fullname' => 'Seed PM',
            'email' => 'seed.pm@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $this->actingAs($headAdmin)
            ->post('/projects', [
                'name' => 'Seeded Construction Project',
                'client' => 'Seed Client',
                'type' => 'Residential',
                'location' => 'QC',
                'assigned' => 'Persistence Foreman',
                'assigned_pm_id' => $pm->id,
                'target' => '2026-12-31',
                'status' => 'PLANNING',
                'phase' => 'Construction',
            ])
            ->assertRedirect();

        $project = Project::where('name', 'Seeded Construction Project')->firstOrFail();

        $expected = \App\Models\WeeklyAccomplishment::defaultScopeOfWorks();
        $this->assertNotEmpty($expected);

        $scopes = ProjectScope::query()
            ->where('project_id', $project->id)
            ->pluck('assigned_personnel', 'scope_name');

        $this->assertEqualsCanonicalizing($expected, $scopes->keys()->all());

        foreach ($scopes as $personnel) {
            $this->assertSame('Persistence Foreman', $personnel);
        }
    }

    public function test_project_creation_seeds_no_scopes_for_design_phase(): void
    {
        $headAdmin = User::create([
            'fullname' => 'Seed Head Admin 2',
            'email' => 'seed.head.admin.2@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_HEAD_ADMIN,
        ]);
        $pm = User::create([
            'fullname' => 'Seed PM 2',
            'email' => 'seed.pm.2@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $this->actingAs($headAdmin)
            ->post('/projects', [
                'name' => 'Seeded Design Project',
                'client' => 'Seed Client',
                'type' => 'Residential',
                'location' => 'QC',
                'assigned' => 'Persistence Foreman',
                'assigned_pm_id' => $pm->id,
                'target' => '2026-12-31',
                'status' => 'PLANNING',
                'phase' => 'Design',
            ])
            ->assertRedirect();

        $project = Project::where('name', 'Seeded Design Project')->firstOrFail();

        $this->assertSame(
            0,
            ProjectScope::query()->where('project_id', $project->id)->count()
        );
    }

    public function test_public_jotform_permanently_lists_assigned_scopes_after_partial_submit(): void
    {
        $this->seedScopes('Persistence Foreman');

        $token = $this->submitToken();

        $this->post("/progress-submit/{$token->token}/submit-all", [
            'weekly_week_start' => $this->monday(),
            'weekly_scopes' => [
                ['scope_of_work' => 'Scope Beta', 'percent_completed' => 25],
            ],
        ])->assertRedirect();

        $this->get("/progress-submit/{$token->token}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/ProgressSubmit')
                ->where('submitToken.weekly_scope_of_works', function ($assigned) {
                    return collect($assigned)->sort()->values()->all() === collect($this->scopeNames)->sort()->values()->all();
                }));
    }

    public function test_pm_accomplishments_keep_saved_scopes_and_list_plan_scopes(): void
    {
        $this->seedScopes('Persistence Foreman');
        \App\Models\ProjectAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->projectManager->id,
            'role_in_project' => 'project_manager',
        ]);

        // PM saves one scope independently (no foreman involved).
        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'week_start' => $this->monday(),
                'scopes' => [
                    ['scope_of_work' => 'Scope Gamma', 'percent_completed' => 60],
                ],
            ])
            ->assertRedirect();

        $this->actingAs($this->projectManager)
            ->get("/project-manager/accomplishments?project_id={$this->project->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                // Saved PM scope persists on reload.
                ->where('savedScopes', fn ($saved) => collect($saved)
                    ->contains(fn ($row) => ($row['scope_of_work'] ?? '') === 'Scope Gamma'
                        && (float) ($row['percent_completed'] ?? 0) === 60.0))
                // Plan scopes stay listed as reference.
                ->where('planScopes', function ($plan) {
                    return collect($plan)->map(fn ($row) => $row['scope_of_work'] ?? null)
                        ->sort()->values()->all() === collect($this->scopeNames)->sort()->values()->all();
                }));
    }
}
