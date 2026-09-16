<?php

namespace Tests\Feature;

use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Services\PublicProgressService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Reassigning a scope to another foreman must move it fully:
 * - the previous foreman's submits for it are dropped (even when they
 *   have zero remaining assignments) and the shared plan is untouched;
 * - the previous foreman loses scope-photo delete access for it;
 * - the new assignee sees the current plan percent on the web jotform
 *   and the mobile jotform, and their submit overrides the shared plan.
 */
class ScopeReassignmentTest extends TestCase
{
    use RefreshDatabase;

    private function monday(): string
    {
        return Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    private function makeForeman(string $name, string $email): User
    {
        return User::create([
            'fullname' => $name,
            'email' => $email,
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);
    }

    private function makeProject(string $name = 'Reassign Project'): Project
    {
        return Project::create([
            'name' => $name,
            'client' => 'Reassign Client',
            'type' => 'Residential',
            'location' => 'QC',
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
        ]);
    }

    private function assignProject(User $foreman, Project $project): void
    {
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => ProjectAssignment::ROLE_FOREMAN,
        ]);
    }

    private function makeToken(User $foreman, Project $project): ProgressSubmitToken
    {
        return ProgressSubmitToken::create([
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'token' => 'pst_' . bin2hex(random_bytes(16)),
            'expires_at' => null,
        ]);
    }

    private function login(User $foreman): string
    {
        return (string) $this->postJson('/api/foreman/login', [
            'email' => $foreman->email,
            'password' => 'password123',
        ])->json('token');
    }

    private function authHeaders(string $token): array
    {
        return [
            'Authorization' => 'Bearer ' . $token,
            'Accept' => 'application/json',
        ];
    }

    public function test_unassigned_foreman_submit_is_dropped_and_plan_kept(): void
    {
        $foremanA = $this->makeForeman('Reassign A', 'reassign.a@example.test');
        $foremanB = $this->makeForeman('Reassign B', 'reassign.b@example.test');
        $project = $this->makeProject();
        $this->assignProject($foremanA, $project);
        $this->assignProject($foremanB, $project);

        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Column',
            'weight_percent' => 10,
            'contract_amount' => 100000,
            'progress_percent' => 50,
            'status' => 'IN_PROGRESS',
            'assigned_personnel' => $foremanA->fullname,
        ]);

        // A previously submitted 40 for Column this week, then the scope
        // was reassigned to B (A now has zero assigned scopes here).
        WeeklyAccomplishment::create([
            'project_id' => $project->id,
            'foreman_id' => $foremanA->id,
            'submitted_by' => $foremanA->id,
            'scope_of_work' => 'Column',
            'percent_completed' => 40,
            'week_start' => $this->monday(),
            'is_placeholder' => false,
        ]);
        ProjectScope::query()
            ->where('project_id', $project->id)
            ->where('scope_name', 'Column')
            ->update(['assigned_personnel' => $foremanB->fullname]);

        $token = $this->login($foremanA);

        $this->postJson("/api/foreman/projects/{$project->id}/submit-all", [
            'weekly_week_start' => $this->monday(),
            'weekly_scopes' => [
                ['scope_of_work' => 'Column', 'percent_completed' => 99],
            ],
        ], $this->authHeaders($token))->assertOk();

        // Nothing new persisted for A and the shared plan still reads 50.
        $this->assertSame(1, WeeklyAccomplishment::query()
            ->where('project_id', $project->id)
            ->where('foreman_id', $foremanA->id)
            ->where('scope_of_work', 'Column')
            ->count());
        $this->assertDatabaseHas('project_scopes', [
            'project_id' => $project->id,
            'scope_name' => 'Column',
            'progress_percent' => 50,
            'assigned_personnel' => $foremanB->fullname,
        ]);
    }

    public function test_claim_flow_still_works_when_project_has_no_scopes(): void
    {
        $foreman = $this->makeForeman('Claim Foreman', 'claim.foreman@example.test');
        $project = $this->makeProject('Claim Project');

        app(PublicProgressService::class)->saveWeeklyProgress(
            $project->id,
            $foreman->id,
            $foreman->fullname,
            $this->monday(),
            [['scope_of_work' => 'New Scope', 'percent_completed' => 30]],
            [],
            true,
            $foreman->id
        );

        $this->assertDatabaseHas('weekly_accomplishments', [
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'scope_of_work' => 'New Scope',
            'percent_completed' => 30,
        ]);
        $this->assertDatabaseHas('project_scopes', [
            'project_id' => $project->id,
            'scope_name' => 'New Scope',
            'assigned_personnel' => $foreman->fullname,
        ]);
    }

    public function test_new_assignee_sees_plan_and_submit_overrides_shared_plan(): void
    {
        $foremanA = $this->makeForeman('Reassign Old', 'reassign.old@example.test');
        $foremanB = $this->makeForeman('Reassign New', 'reassign.new@example.test');
        $project = $this->makeProject('Takeover Project');
        $this->assignProject($foremanA, $project);
        $this->assignProject($foremanB, $project);

        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Column',
            'weight_percent' => 10,
            'contract_amount' => 100000,
            'progress_percent' => 50,
            'status' => 'IN_PROGRESS',
            'assigned_personnel' => $foremanB->fullname,
        ]);

        $tokenB = $this->makeToken($foremanB, $project);
        $monday = $this->monday();

        // Web jotform: Column listed with the plan 50 (not 0), even though
        // B has never submitted it.
        $this->get("/progress-submit/{$tokenB->token}")
            ->assertOk()
            ->assertInertia(function ($page) use ($monday) {
                $page->component('Public/ProgressSubmit')
                    ->where('submitToken.weekly_scope_of_works', function ($scopes) {
                        $this->assertTrue(collect($scopes)->contains('Column'));

                        return true;
                    })
                    ->where('submitToken.weekly_saved_by_week', function ($byWeek) use ($monday) {
                        $rows = $byWeek[$monday] ?? [];
                        $column = collect($rows)->firstWhere('scope_of_work', 'Column');
                        $this->assertNotNull($column, 'Expected the plan-backed Column row.');
                        $this->assertEquals('50', (string) ($column['percent_completed'] ?? ''));

                        return true;
                    });
            });

        // Mobile jotform: same plan-backed row for the new assignee.
        $token = $this->login($foremanB);
        $jotform = $this->getJson(
            "/api/foreman/projects/{$project->id}/jotform",
            $this->authHeaders($token)
        )->assertOk();

        $this->assertTrue(collect($jotform->json('assigned_scope_names'))->contains('Column'));
        $mobileColumn = collect($jotform->json('weekly_current_week'))
            ->first(fn ($row) => trim((string) ($row['scope_of_work'] ?? '')) === 'Column');
        $this->assertNotNull($mobileColumn, 'Expected the plan-backed Column row on mobile.');
        $this->assertEquals(50, (float) ($mobileColumn['percent_completed'] ?? -1));

        // B's submit overrides the shared plan everywhere.
        $this->postJson("/api/foreman/projects/{$project->id}/submit-all", [
            'weekly_week_start' => $monday,
            'weekly_scopes' => [
                ['scope_of_work' => 'Column', 'percent_completed' => 70],
            ],
        ], $this->authHeaders($token))->assertOk();

        $this->assertDatabaseHas('project_scopes', [
            'project_id' => $project->id,
            'scope_name' => 'Column',
            'progress_percent' => 70,
        ]);
        $this->assertDatabaseHas('weekly_accomplishments', [
            'project_id' => $project->id,
            'foreman_id' => $foremanB->id,
            'scope_of_work' => 'Column',
            'percent_completed' => 70,
        ]);
    }

    public function test_previous_foreman_loses_scope_photo_delete_access(): void
    {
        $foremanA = $this->makeForeman('Photo Old', 'photo.old@example.test');
        $foremanB = $this->makeForeman('Photo New', 'photo.new@example.test');
        $project = $this->makeProject('Photo Project');
        $this->assignProject($foremanA, $project);
        $this->assignProject($foremanB, $project);

        $scope = ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Column',
            'weight_percent' => 10,
            'progress_percent' => 50,
            'status' => 'IN_PROGRESS',
            'assigned_personnel' => $foremanB->fullname,
        ]);

        $photo = ScopePhoto::create([
            'project_scope_id' => $scope->id,
            'photo_path' => 'scope-photos/reassigned.jpg',
            'caption' => '[Jotform Weekly] | Week: ' . $this->monday() . ' | Scope: Column',
        ]);

        $tokenA = $this->makeToken($foremanA, $project);

        // Web jotform (A has history elsewhere but the scope is B's now).
        WeeklyAccomplishment::create([
            'project_id' => $project->id,
            'foreman_id' => $foremanA->id,
            'submitted_by' => $foremanA->id,
            'scope_of_work' => 'Column',
            'percent_completed' => 40,
            'week_start' => $this->monday(),
            'is_placeholder' => false,
        ]);

        $this->delete("/progress-submit/{$tokenA->token}/weekly-photos/{$photo->id}")
            ->assertForbidden();
        $this->assertDatabaseHas('scope_photos', ['id' => $photo->id]);

        // Mobile API: same denial.
        $token = $this->login($foremanA);
        $this->deleteJson(
            "/api/foreman/scope-photos/{$photo->id}",
            [],
            $this->authHeaders($token)
        )->assertNotFound();
        $this->assertDatabaseHas('scope_photos', ['id' => $photo->id]);

        // The current assignee can still delete.
        $tokenB = $this->login($foremanB);
        $this->deleteJson(
            "/api/foreman/scope-photos/{$photo->id}",
            [],
            $this->authHeaders($tokenB)
        )->assertOk();
        $this->assertSoftDeleted('scope_photos', ['id' => $photo->id]);
    }
}
