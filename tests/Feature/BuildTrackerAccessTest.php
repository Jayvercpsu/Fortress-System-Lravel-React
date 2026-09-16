<?php

namespace Tests\Feature;

use App\Models\BuildProject;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BuildTrackerAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_and_admin_can_open_build_tracker_page(): void
    {
        $projectOne = $this->makeProject('Build Project One');
        $projectTwo = $this->makeProject('Build Project Two');

        $this->actingAs($this->makeUser('head_admin'))
            ->get("/projects/{$projectOne->id}/build")
            ->assertOk();

        $this->actingAs($this->makeUser('admin'))
            ->get("/projects/{$projectTwo->id}/build")
            ->assertOk();
    }

    public function test_hr_and_foreman_cannot_open_build_tracker_page(): void
    {
        $project = $this->makeProject('Build Restricted Project');

        $this->actingAs($this->makeUser('hr'))
            ->get("/projects/{$project->id}/build")
            ->assertForbidden();

        $this->actingAs($this->makeUser('foreman'))
            ->get("/projects/{$project->id}/build")
            ->assertForbidden();
    }

    public function test_admin_can_update_build_tracker_record(): void
    {
        $project = $this->makeProject('Build Update Project');

        $this->actingAs($this->makeUser('admin'))
            ->patch("/projects/{$project->id}/build", [
                'construction_contract' => 1000000,
                'total_client_payment' => 300000,
                'materials_cost' => 120000,
                'labor_cost' => 80000,
                'equipment_cost' => 50000,
            ])
            ->assertRedirect("/projects/{$project->id}/build");

        $this->assertDatabaseHas('build_projects', [
            'project_id' => $project->id,
            'construction_contract' => 1000000,
            'total_client_payment' => 300000,
            'materials_cost' => 120000,
            'labor_cost' => 80000,
            'equipment_cost' => 50000,
        ]);

        $build = BuildProject::where('project_id', $project->id)->firstOrFail();
        $totalExpenses = (float) $build->materials_cost + (float) $build->labor_cost + (float) $build->equipment_cost;
        $paymentProgress = (float) $build->total_client_payment / (float) $build->construction_contract * 100;

        $this->assertSame(250000.0, $totalExpenses);
        $this->assertSame(30.0, $paymentProgress);
    }

    public function test_hr_and_foreman_cannot_update_build_tracker_record(): void
    {
        $project = $this->makeProject('Build Forbidden Update Project');

        $payload = [
            'construction_contract' => 500000,
            'total_client_payment' => 200000,
            'materials_cost' => 100000,
            'labor_cost' => 50000,
            'equipment_cost' => 25000,
        ];

        $this->actingAs($this->makeUser('hr'))
            ->patch("/projects/{$project->id}/build", $payload)
            ->assertForbidden();

        $this->actingAs($this->makeUser('foreman'))
            ->patch("/projects/{$project->id}/build", $payload)
            ->assertForbidden();

        $this->assertDatabaseMissing('build_projects', ['project_id' => $project->id]);
    }

    public function test_build_page_progress_and_assignees_are_pm_based(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $pm = $this->makeUser('project_manager');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject('PM Build Project');

        \App\Models\ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $pm->id,
            'role_in_project' => \App\Models\ProjectAssignment::ROLE_PROJECT_MANAGER,
        ]);
        \App\Models\ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => \App\Models\ProjectAssignment::ROLE_FOREMAN,
        ]);

        $scope = \App\Models\ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Masonry',
            'weight_percent' => 50,
            'progress_percent' => 100,
            'status' => 'IN_PROGRESS',
            'assigned_personnel' => $foreman->fullname,
        ]);

        \App\Models\WeeklyAccomplishment::create([
            'project_id' => $project->id,
            'foreman_id' => null,
            'submitted_by' => $pm->id,
            'scope_of_work' => 'Masonry',
            'percent_completed' => 40,
            'week_start' => now()->startOfWeek()->toDateString(),
            'is_placeholder' => false,
        ]);
        \App\Models\ScopePhoto::create([
            'project_scope_id' => $scope->id,
            'photo_path' => 'scope-photos/pm-build.jpg',
            'caption' => '[PM Weekly] | Week: ' . now()->startOfWeek()->toDateString() . ' | Scope: Masonry',
        ]);
        \App\Models\ScopePhoto::create([
            'project_scope_id' => $scope->id,
            'photo_path' => 'scope-photos/foreman-build.jpg',
            'caption' => '[Jotform Weekly] | Week: ' . now()->startOfWeek()->toDateString() . ' | Scope: Masonry',
        ]);

        $this->actingAs($headAdmin)
            ->get("/projects/{$project->id}/build")
            ->assertOk()
            ->assertInertia(function ($page) use ($pm, $foreman) {
                $page->component('HeadAdmin/Build/Show')
                    // Overall from PM (50 x 40 / 100 = 20), not the plan 100.
                    ->where('monitoring.project.overall_progress', 20)
                    ->where('monitoring.scopes.0.scope_name', 'Masonry')
                    ->where('monitoring.scopes.0.progress_percent', 100)
                    ->where('monitoring.scopes.0.pm_progress_percent', 40)
                    ->where('monitoring.scopes.0.assigned_pm', $pm->fullname)
                    ->where('monitoring.scopes.0.photos', function ($photos) use ($pm, $foreman) {
                        // Both sides shown, each labeled.
                        $byPath = collect($photos)->keyBy('photo_path');
                        $this->assertCount(2, $byPath);
                        $this->assertSame($pm->fullname, $byPath['scope-photos/pm-build.jpg']['submitted_by_name'] ?? null);
                        $this->assertSame('PM', $byPath['scope-photos/pm-build.jpg']['submitted_by_type'] ?? null);
                        $this->assertSame($foreman->fullname, $byPath['scope-photos/foreman-build.jpg']['submitted_by_name'] ?? null);
                        $this->assertSame('Foreman', $byPath['scope-photos/foreman-build.jpg']['submitted_by_type'] ?? null);

                        return true;
                    });
            });
    }

    public function test_build_page_upload_with_pm_tag_stores_pm_side_photo(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $headAdmin = $this->makeUser('head_admin');
        $project = $this->makeProject('PM Build Upload Project');
        $scope = \App\Models\ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Masonry',
            'weight_percent' => 50,
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
        ]);

        $this->actingAs($headAdmin)
            ->post("/scopes/{$scope->id}/photos", [
                'photo' => \Illuminate\Http\UploadedFile::fake()->image('build-pm.jpg'),
                'caption' => 'Header beams',
                'as_pm' => 'pm',
            ])
            ->assertRedirect();

        $photo = \App\Models\ScopePhoto::query()
            ->where('project_scope_id', $scope->id)
            ->firstOrFail();

        // PM-side tag: hidden from the foreman jotform, shown on PM surfaces.
        $this->assertStringStartsWith('[PM Weekly]', (string) $photo->caption);
        $this->assertStringContainsString('Header beams', (string) $photo->caption);

        // Uploader recorded for role-accurate labels.
        $this->assertDatabaseHas('scope_photos', [
            'project_scope_id' => $scope->id,
            'submitted_by' => $headAdmin->id,
            'submitted_by_role' => 'head_admin',
        ]);
    }

    public function test_build_page_labels_photo_by_recording_uploader_role(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $project = $this->makeProject('PM Build Label Project');

        $scope = \App\Models\ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Masonry',
            'weight_percent' => 50,
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
        ]);

        // Untagged manual upload still labels by recorded uploader.
        \App\Models\ScopePhoto::create([
            'project_scope_id' => $scope->id,
            'photo_path' => 'scope-photos/manual-admin.jpg',
            'caption' => 'Manual site shot',
            'submitted_by' => $headAdmin->id,
            'submitted_by_role' => 'head_admin',
        ]);

        $this->actingAs($headAdmin)
            ->get("/projects/{$project->id}/build")
            ->assertOk()
            ->assertInertia(function ($page) use ($headAdmin) {
                $page->component('HeadAdmin/Build/Show')
                    ->where('monitoring.scopes.0.photos.0.photo_path', 'scope-photos/manual-admin.jpg')
                    ->where('monitoring.scopes.0.photos.0.submitted_by_name', $headAdmin->fullname)
                    ->where('monitoring.scopes.0.photos.0.submitted_by_type', 'Head Admin');
            });
    }

    public function test_build_upload_can_target_foreman_side(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $headAdmin = $this->makeUser('head_admin');
        $project = $this->makeProject('PM Build Foreman Upload Project');
        $scope = \App\Models\ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Masonry',
            'weight_percent' => 50,
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
        ]);

        $this->actingAs($headAdmin)
            ->post("/scopes/{$scope->id}/photos", [
                'photo' => \Illuminate\Http\UploadedFile::fake()->image('build-foreman.jpg'),
                'caption' => 'Rebar check',
                'photo_side' => 'foreman',
            ])
            ->assertRedirect();

        $photo = \App\Models\ScopePhoto::query()
            ->where('project_scope_id', $scope->id)
            ->firstOrFail();

        $this->assertStringStartsWith('[Jotform Weekly]', (string) $photo->caption);
        $this->assertStringContainsString('Rebar check', (string) $photo->caption);
    }

    private function makeUser(string $role): User
    {
        return User::create([
            'fullname' => ucfirst($role) . ' User',
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
