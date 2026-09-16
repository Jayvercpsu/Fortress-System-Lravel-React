<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * PM progress is the single source of truth across surfaces:
 * /projects cards, weekly overview, and the progress receipt all read
 * the same PmProgressService value (independent PM rows only).
 * Also covers PM assign / replace / remove on projects.
 */
class PmProgressConsistencyTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role): User
    {
        return User::create([
            'fullname' => ucfirst(str_replace('_', ' ', $role)).' '.uniqid(),
            'email' => $role.'_'.uniqid().'@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }

    public function test_project_cards_use_pm_progress_not_foreman(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $pm = $this->makeUser('project_manager');
        $foreman = $this->makeUser('foreman');

        $project = Project::create([
            'name' => 'PM Card Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => $foreman->fullname,
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
            'user_id' => $headAdmin->id,
        ]);
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $pm->id,
            'role_in_project' => ProjectAssignment::ROLE_PROJECT_MANAGER,
        ]);
        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Column Footing',
            'weight_percent' => 100,
            'progress_percent' => 100,
            'status' => 'IN_PROGRESS',
        ]);

        // Foreman reports 100 via JotForm rows, PM reports 25 independently.
        WeeklyAccomplishment::create([
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'submitted_by' => $foreman->id,
            'scope_of_work' => 'Column Footing',
            'percent_completed' => 100,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);
        WeeklyAccomplishment::create([
            'project_id' => $project->id,
            'foreman_id' => null,
            'submitted_by' => $pm->id,
            'scope_of_work' => 'Column Footing',
            'percent_completed' => 25,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);

        // Cards read 25 (PM), never the foreman 100.
        $this->actingAs($headAdmin)
            ->get('/projects')
            ->assertOk()
            ->assertInertia(function ($page) use ($pm) {
                $page->component('HeadAdmin/Projects/Index')
                    ->where('projectBoard.columns.0.projects', function ($projects) use ($pm) {
                        $card = collect($projects)->firstWhere('name', 'PM Card Project');
                        $this->assertNotNull($card, 'Expected the PM card project on the board.');
                        $this->assertEquals(25, (float) ($card['overall_progress'] ?? -1));
                        $this->assertEquals(25, (float) ($card['construction_progress'] ?? -1));
                        $this->assertSame($pm->fullname, $card['assigned_pm'] ?? null);

                        return true;
                    });
            });

        // Weekly overview Overall Progress matches the card (PM-based).
        $this->actingAs($headAdmin)
            ->get('/weekly-accomplishments/'.$project->id)
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/WeeklyAccomplishments/Show')
                ->where('comparison.pm_progress', 25)
                ->where('comparison.overall_progress', 25));
    }

    public function test_receipt_weighted_progress_is_pm_based(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $pm = $this->makeUser('project_manager');
        $foreman = $this->makeUser('foreman');

        $project = Project::create([
            'name' => 'PM Receipt Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => $foreman->fullname,
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
            'user_id' => $headAdmin->id,
        ]);
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => ProjectAssignment::ROLE_FOREMAN,
        ]);
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $pm->id,
            'role_in_project' => ProjectAssignment::ROLE_PROJECT_MANAGER,
        ]);
        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Masonry',
            'weight_percent' => 50,
            'progress_percent' => 100,
            'status' => 'IN_PROGRESS',
        ]);
        ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Roofing',
            'weight_percent' => 50,
            'progress_percent' => 100,
            'status' => 'IN_PROGRESS',
        ]);
        WeeklyAccomplishment::create([
            'project_id' => $project->id,
            'foreman_id' => null,
            'submitted_by' => $pm->id,
            'scope_of_work' => 'Masonry',
            'percent_completed' => 40,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);

        $masonryScopeId = ProjectScope::query()
            ->where('project_id', $project->id)
            ->where('scope_name', 'Masonry')
            ->value('id');
        \App\Models\ScopePhoto::create([
            'project_scope_id' => $masonryScopeId,
            'photo_path' => 'scope-photos/pm-receipt.jpg',
            'caption' => '[PM Weekly] | Week: ' . now()->startOfWeek()->toDateString() . ' | Scope: Masonry',
        ]);
        \App\Models\ScopePhoto::create([
            'project_scope_id' => $masonryScopeId,
            'photo_path' => 'scope-photos/foreman-receipt.jpg',
            'caption' => '[Jotform Weekly] | Week: ' . now()->startOfWeek()->toDateString() . ' | Scope: Masonry',
        ]);

        // Receipt uses PM rows (50*40/100 = 20), not the plan 100s.
        $redirect = $this->actingAs($headAdmin)
            ->get("/projects/{$project->id}/client-receipt")
            ->assertRedirect();
        $receiptUrl = parse_url($redirect->headers->get('Location'), PHP_URL_PATH);

        $this->actingAs($headAdmin)
            ->get($receiptUrl)
            ->assertOk()
            ->assertInertia(function ($page) use ($pm, $foreman) {
                $page->component('Public/ProgressReceipt')
                    ->where('receipt.weighted_progress_percent', function ($value) {
                        $this->assertEquals(20, (float) $value);

                        return true;
                    })
                    ->where('totals.weighted_progress_percent', function ($value) {
                        $this->assertEquals(20, (float) $value);

                        return true;
                    })
                    ->where('scopes', function ($scopes) use ($pm, $foreman) {
                        $masonry = collect($scopes)->firstWhere('scope_name', 'Masonry');
                        $this->assertNotNull($masonry, 'Expected the Masonry scope row.');
                        // PM progress, not the plan 100.
                        $this->assertEquals(40, (float) ($masonry['progress_percent'] ?? -1));
                        // Receipt photos combine both sides.
                        $paths = collect($masonry['photos'] ?? [])->pluck('photo_path')->all();
                        $this->assertContains('scope-photos/pm-receipt.jpg', $paths);
                        $this->assertContains('scope-photos/foreman-receipt.jpg', $paths);
                        // Modal submitter labels resolve per caption tag.
                        $byPath = collect($masonry['photos'] ?? [])->keyBy('photo_path');
                        $this->assertSame($pm->fullname, $byPath['scope-photos/pm-receipt.jpg']['submitted_by_name'] ?? null);
                        $this->assertSame('PM', $byPath['scope-photos/pm-receipt.jpg']['submitted_by_type'] ?? null);
                        $this->assertSame($foreman->fullname, $byPath['scope-photos/foreman-receipt.jpg']['submitted_by_name'] ?? null);
                        $this->assertSame('Foreman', $byPath['scope-photos/foreman-receipt.jpg']['submitted_by_type'] ?? null);
                        // Assignees carry the assigned PM and foreman.
                        $names = collect($masonry['assignees'] ?? [])->pluck('name')->all();
                        $this->assertContains($pm->fullname, $names);
                        $this->assertContains($foreman->fullname, $names);

                        return true;
                    });
            });
    }

    public function test_pm_assignment_is_required_and_replaceable(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $pmA = $this->makeUser('project_manager');
        $pmB = $this->makeUser('project_manager');

        $this->actingAs($headAdmin)->post('/projects', [
            'name' => 'PM Assign Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => 'Team 1',
            'assigned_pm_id' => $pmA->id,
            'target' => '2026-12-31',
            'status' => 'PLANNING',
            'phase' => 'Design',
        ])->assertRedirect();

        $project = Project::where('name', 'PM Assign Project')->firstOrFail();
        $this->assertDatabaseHas('project_assignments', [
            'project_id' => $project->id,
            'user_id' => $pmA->id,
            'role_in_project' => ProjectAssignment::ROLE_PROJECT_MANAGER,
        ]);

        // Replace with PM B (same project, no duplicate rows).
        $this->actingAs($headAdmin)->patch("/projects/{$project->id}", [
            'name' => 'PM Assign Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => 'Team 1',
            'assigned_pm_id' => $pmB->id,
            'target' => '2026-12-31',
            'status' => 'ACTIVE',
            'phase' => 'Design',
        ])->assertRedirect();

        $this->assertSame(1, ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->where('role_in_project', ProjectAssignment::ROLE_PROJECT_MANAGER)
            ->count());
        $this->assertDatabaseHas('project_assignments', [
            'project_id' => $project->id,
            'user_id' => $pmB->id,
        ]);

        // Re-saving the same PM is idempotent (no unique violation).
        $this->actingAs($headAdmin)->patch("/projects/{$project->id}", [
            'name' => 'PM Assign Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => 'Team 1',
            'assigned_pm_id' => $pmB->id,
            'target' => '2026-12-31',
            'status' => 'ACTIVE',
            'phase' => 'Design',
        ])->assertRedirect();

        // Assigned PM is required: clearing it fails validation and keeps PM B.
        $this->actingAs($headAdmin)->patch("/projects/{$project->id}", [
            'name' => 'PM Assign Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => 'Team 1',
            'assigned_pm_id' => null,
            'target' => '2026-12-31',
            'status' => 'ACTIVE',
            'phase' => 'Design',
        ])->assertSessionHasErrors('assigned_pm_id');

        $this->assertSame(1, ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->where('role_in_project', ProjectAssignment::ROLE_PROJECT_MANAGER)
            ->count());
        $this->assertDatabaseHas('project_assignments', [
            'project_id' => $project->id,
            'user_id' => $pmB->id,
        ]);

        // Creating without a PM also fails validation.
        $this->actingAs($headAdmin)->post('/projects', [
            'name' => 'PM Missing Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => 'Team 1',
            'target' => '2026-12-31',
            'status' => 'PLANNING',
            'phase' => 'Design',
        ])->assertSessionHasErrors('assigned_pm_id');
    }
}
