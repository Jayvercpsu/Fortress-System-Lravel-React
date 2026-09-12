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
 * Cross-surface ordering scenarios for weekly progress submit-all.
 *
 * Setup per scenario: create a project, assign the foreman, seed scopes
 * assigned to that foreman. Then the three surfaces submit in every order:
 *
 *  1. foreman jotform -> PM accomplishment -> foreman mobile
 *  2. PM accomplishment -> foreman jotform -> foreman mobile
 *  3. foreman mobile -> PM accomplishment -> foreman jotform
 *
 * Purpose: after EVERY submit, the foreman-assigned scopes must remain
 * permanently displayed on ALL THREE surfaces (public jotform payload,
 * PM accomplishments payload, mobile jotform payload), and every
 * surface's edits must accumulate instead of wiping the others out.
 */
class WeeklyProgressCrossSurfaceTest extends TestCase
{
    use RefreshDatabase;

    private User $foreman;

    private User $projectManager;

    private Project $project;

    private ProgressSubmitToken $token;

    /** @var string[] */
    private array $scopeNames = [
        'Cross Alpha',
        'Cross Beta',
        'Cross Gamma',
        'Cross Delta',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->foreman = User::create([
            'fullname' => 'Cross Foreman',
            'email' => 'cross.foreman@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $this->projectManager = User::create([
            'fullname' => 'Cross PM',
            'email' => 'cross.pm@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $this->project = Project::create([
            'name' => 'Cross Surface Project',
            'client' => 'Cross Client',
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

        foreach ($this->scopeNames as $index => $name) {
            ProjectScope::create([
                'project_id' => $this->project->id,
                'scope_name' => $name,
                'progress_percent' => 0,
                'status' => 'NOT_STARTED',
                'assigned_personnel' => 'Cross Foreman',
                'sort_order' => $index + 1,
            ]);
        }

        $this->token = ProgressSubmitToken::create([
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
            'token' => 'cross-surface-token',
        ]);
    }

    private function monday(): string
    {
        return Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    private function mobileHeaders(): array
    {
        $token = (string) $this->postJson('/api/foreman/login', [
            'email' => 'cross.foreman@example.test',
            'password' => 'password123',
        ])->json('token');

        return ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'];
    }

    private function submitViaJotform(string $scope, int $percent): void
    {
        $this->post("/progress-submit/{$this->token->token}/submit-all", [
            'weekly_week_start' => $this->monday(),
            'weekly_scopes' => [
                ['scope_of_work' => $scope, 'percent_completed' => $percent],
            ],
        ])->assertRedirect();
    }

    private function submitViaPm(string $scope, int $percent): void
    {
        $this->actingAs($this->projectManager)
            ->post('/project-manager/accomplishments', [
                'project_id' => $this->project->id,
                'foreman_id' => $this->foreman->id,
                'week_start' => $this->monday(),
                'scopes' => [
                    ['scope_of_work' => $scope, 'percent_completed' => $percent],
                ],
            ])
            ->assertRedirect();
    }

    private function submitViaMobile(string $scope, int $percent): void
    {
        $this->post("/api/foreman/projects/{$this->project->id}/submit-all", [
            'weekly_week_start' => $this->monday(),
            'weekly_scopes' => [
                ['scope_of_work' => $scope, 'percent_completed' => $percent],
            ],
        ], $this->mobileHeaders())->assertOk();
    }

    private function assertJotformListsAllScopes(string $message): void
    {
        $this->get("/progress-submit/{$this->token->token}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/ProgressSubmit')
                ->where('submitToken.weekly_scope_of_works', function ($assigned) use ($message) {
                    $this->assertEqualsCanonicalizing(
                        $this->scopeNames,
                        collect($assigned)->values()->all(),
                        $message
                    );

                    return true;
                }));
    }

    private function assertPmListsAllScopes(string $message): void
    {
        $this->actingAs($this->projectManager)
            ->get("/project-manager/accomplishments?project_id={$this->project->id}&foreman_id={$this->foreman->id}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('ProjectManager/Accomplishments')
                ->where('weekly.weekly_scope_of_works', function ($assigned) use ($message) {
                    $this->assertEqualsCanonicalizing(
                        $this->scopeNames,
                        collect($assigned)->values()->all(),
                        $message
                    );

                    return true;
                }));
    }

    private function assertMobileListsAllScopes(string $message): void
    {
        $payload = $this->getJson(
            "/api/foreman/projects/{$this->project->id}/jotform",
            $this->mobileHeaders()
        )->assertOk()->json();

        $this->assertEqualsCanonicalizing(
            $this->scopeNames,
            array_column($payload['scopes'], 'scope_name'),
            $message
        );
    }

    private function assertAllSurfacesListAllScopes(string $step): void
    {
        $this->assertJotformListsAllScopes("Public jotform lost scopes after {$step}.");
        $this->assertPmListsAllScopes("PM accomplishments lost scopes after {$step}.");
        $this->assertMobileListsAllScopes("Mobile jotform lost scopes after {$step}.");
    }

    private function assertAllEditsAccumulated(): void
    {
        $expected = [
            'Cross Alpha' => 10.0,
            'Cross Beta' => 20.0,
            'Cross Gamma' => 30.0,
        ];

        $this->get("/progress-submit/{$this->token->token}")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/ProgressSubmit')
                ->where('submitToken.weekly_saved_by_week', function ($byWeek) use ($expected) {
                    $rows = collect($byWeek[$this->monday()] ?? [])
                        ->mapWithKeys(fn ($row) => [
                            trim((string) ($row['scope_of_work'] ?? '')) => (float) ($row['percent_completed'] ?? 0),
                        ]);

                    foreach ($expected as $scope => $percent) {
                        $this->assertEquals(
                            $percent,
                            $rows->get($scope),
                            "Edit for {$scope} did not survive the cross-surface submits."
                        );
                    }

                    return true;
                }));
    }

    public function test_order_jotform_then_pm_then_mobile(): void
    {
        $this->assertAllSurfacesListAllScopes('project setup');

        $this->submitViaJotform('Cross Alpha', 10);
        $this->assertAllSurfacesListAllScopes('jotform submit-all');

        $this->submitViaPm('Cross Beta', 20);
        $this->assertAllSurfacesListAllScopes('PM submit-all');

        $this->submitViaMobile('Cross Gamma', 30);
        $this->assertAllSurfacesListAllScopes('mobile submit-all');

        $this->assertAllEditsAccumulated();
    }

    public function test_order_pm_then_jotform_then_mobile(): void
    {
        $this->assertAllSurfacesListAllScopes('project setup');

        $this->submitViaPm('Cross Alpha', 10);
        $this->assertAllSurfacesListAllScopes('PM submit-all');

        $this->submitViaJotform('Cross Beta', 20);
        $this->assertAllSurfacesListAllScopes('jotform submit-all');

        $this->submitViaMobile('Cross Gamma', 30);
        $this->assertAllSurfacesListAllScopes('mobile submit-all');

        $this->assertAllEditsAccumulated();
    }

    public function test_order_mobile_then_pm_then_jotform(): void
    {
        $this->assertAllSurfacesListAllScopes('project setup');

        $this->submitViaMobile('Cross Alpha', 10);
        $this->assertAllSurfacesListAllScopes('mobile submit-all');

        $this->submitViaPm('Cross Beta', 20);
        $this->assertAllSurfacesListAllScopes('PM submit-all');

        $this->submitViaJotform('Cross Gamma', 30);
        $this->assertAllSurfacesListAllScopes('jotform submit-all');

        $this->assertAllEditsAccumulated();
    }
}
