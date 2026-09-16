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
 * Data-separation scenarios between foreman surfaces and the PM surface.
 *
 * Setup per scenario: create a project, assign the foreman AND the PM,
 * seed scopes assigned to that foreman.
 *
 * Rules under test:
 *  1. The foreman surfaces (public jotform + foreman mobile) share one
 *     data source: edits on either accumulate on both.
 *  2. The PM surface is independent: PM saves never appear on foreman
 *     surfaces, and foreman saves never appear on the PM grid.
 *  3. PM saves never move the shared scope-plan progress or the project
 *     snapshot (those stay foreman-driven).
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
        ProjectAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->projectManager->id,
            'role_in_project' => ProjectAssignment::ROLE_PROJECT_MANAGER,
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

    private function jotformSaved(): array
    {
        $saved = [];
        $monday = $this->monday();
        $this->get("/progress-submit/{$this->token->token}")
            ->assertOk()
            ->assertInertia(function ($page) use (&$saved, $monday) {
                $page
                    ->component('Public/ProgressSubmit')
                    ->where('submitToken.weekly_saved_by_week', function ($byWeek) use (&$saved, $monday) {
                        $saved = collect($byWeek[$monday] ?? [])
                            ->mapWithKeys(fn ($row) => [
                                trim((string) ($row['scope_of_work'] ?? '')) => (float) ($row['percent_completed'] ?? 0),
                            ])
                            ->all();

                        return true;
                    });
            });

        return $saved;
    }

    private function pmSaved(): array
    {
        $saved = [];
        $this->actingAs($this->projectManager)
            ->get("/project-manager/accomplishments?project_id={$this->project->id}")
            ->assertOk()
            ->assertInertia(function ($page) use (&$saved) {
                $page
                    ->component('ProjectManager/Accomplishments')
                    ->where('savedScopes', function ($scopes) use (&$saved) {
                        $saved = collect($scopes)
                            ->mapWithKeys(fn ($row) => [
                                trim((string) ($row['scope_of_work'] ?? '')) => (float) ($row['percent_completed'] ?? 0),
                            ])
                            ->all();

                        return true;
                    });
            });

        return $saved;
    }

    private function assertForemanSurfacesListAllScopes(string $message): void
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

    public function test_foreman_surfaces_share_data_while_pm_stays_independent(): void
    {
        $this->assertForemanSurfacesListAllScopes('project setup');

        // Foreman submits via the public jotform...
        $this->submitViaJotform('Cross Alpha', 10);
        // ...and via foreman mobile: both accumulate on the foreman side.
        $this->submitViaMobile('Cross Gamma', 30);

        $saved = $this->jotformSaved();
        $this->assertSame(10.0, $saved['Cross Alpha'] ?? null);
        $this->assertSame(30.0, $saved['Cross Gamma'] ?? null);
        $this->assertForemanSurfacesListAllScopes('foreman submits');

        // The PM grid is untouched by foreman activity.
        $this->assertSame([], $this->pmSaved());

        // PM submits independently...
        $this->submitViaPm('Cross Beta', 20);

        // ...visible only on the PM grid...
        $pmSaved = $this->pmSaved();
        $this->assertSame(20.0, $pmSaved['Cross Beta'] ?? null);
        $this->assertArrayNotHasKey('Cross Alpha', $pmSaved);
        $this->assertArrayNotHasKey('Cross Gamma', $pmSaved);

        // ...and invisible on the foreman surfaces.
        $saved = $this->jotformSaved();
        $this->assertSame(10.0, $saved['Cross Alpha'] ?? null);
        $this->assertSame(30.0, $saved['Cross Gamma'] ?? null);
        $this->assertArrayNotHasKey('Cross Beta', $saved);
    }

    public function test_pm_save_does_not_move_plan_or_snapshot_progress(): void
    {
        $this->submitViaJotform('Cross Alpha', 10);

        $this->assertSame(10, (int) $this->project->refresh()->overall_progress);
        $this->assertSame(10, (int) ProjectScope::query()
            ->where('project_id', $this->project->id)
            ->where('scope_name', 'Cross Alpha')
            ->value('progress_percent'));

        // PM saves 90 on the same scope: shared numbers must not move.
        $this->submitViaPm('Cross Alpha', 90);

        $this->assertSame(10, (int) $this->project->refresh()->overall_progress);
        $this->assertSame(10, (int) ProjectScope::query()
            ->where('project_id', $this->project->id)
            ->where('scope_name', 'Cross Alpha')
            ->value('progress_percent'));

        // ...while the PM's own grid carries the 90.
        $this->assertSame(90.0, $this->pmSaved()['Cross Alpha'] ?? null);
    }
}
