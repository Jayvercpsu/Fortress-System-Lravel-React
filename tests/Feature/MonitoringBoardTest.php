<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MonitoringBoardTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_can_manage_scopes_and_overall_progress_recomputes(): void
    {
        $project = $this->makeProject();
        $headAdmin = $this->makeUser('head_admin');

        $this->actingAs($headAdmin)
            ->post("/projects/{$project->id}/scopes", [
                'scope_name' => 'Foundation',
                'assigned_personnel' => 'Crew A',
                'progress_percent' => 20,
                'status' => 'IN_PROGRESS',
                'remarks' => 'Started excavation.',
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(20, (int) $project->overall_progress);

        $firstScope = ProjectScope::where('project_id', $project->id)->firstOrFail();

        $this->actingAs($headAdmin)
            ->patch("/scopes/{$firstScope->id}", [
                'scope_name' => 'Foundation',
                'assigned_personnel' => 'Crew A',
                'progress_percent' => 80,
                'status' => 'IN_PROGRESS',
                'remarks' => 'Nearly done.',
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(80, (int) $project->overall_progress);

        $this->actingAs($headAdmin)
            ->post("/projects/{$project->id}/scopes", [
                'scope_name' => 'Roofing',
                'assigned_personnel' => 'Crew B',
                'progress_percent' => 20,
                'status' => 'NOT_STARTED',
                'remarks' => null,
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(50, (int) $project->overall_progress);

        $secondScope = ProjectScope::where('project_id', $project->id)
            ->where('scope_name', 'Roofing')
            ->firstOrFail();

        $this->actingAs($headAdmin)
            ->delete("/scopes/{$secondScope->id}")
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(80, (int) $project->overall_progress);
    }

    public function test_admin_can_view_monitoring_board_but_hr_cannot_access_it(): void
    {
        $project = $this->makeProject();

        $this->actingAs($this->makeUser('admin'))
            ->get("/projects/{$project->id}/monitoring")
            ->assertOk();

        $this->actingAs($this->makeUser('hr'))
            ->get("/projects/{$project->id}/monitoring")
            ->assertForbidden();
    }

    public function test_scope_recompute_to_100_auto_closes_project_and_notifies_hr_and_head_admin(): void
    {
        $project = $this->makeProject();
        $headAdmin = $this->makeUser('head_admin');
        $hr = $this->makeUser('hr');

        $this->actingAs($headAdmin)
            ->post("/projects/{$project->id}/scopes", [
                'scope_name' => 'Final Turnover',
                'assigned_personnel' => 'Crew X',
                'progress_percent' => 100,
                'status' => 'COMPLETED',
                'remarks' => 'All scope items done.',
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(100, (int) $project->overall_progress);
        $this->assertSame('COMPLETED', $project->status);

        $this->assertGreaterThan(0, $headAdmin->notifications()->count());
        $this->assertGreaterThan(0, $hr->notifications()->count());
    }

    public function test_head_admin_can_upload_scope_photo_with_caption(): void
    {
        Storage::fake('public');

        $project = $this->makeProject();
        $scope = ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Formworks',
            'assigned_personnel' => 'Crew C',
            'progress_percent' => 25,
            'status' => 'IN_PROGRESS',
            'remarks' => null,
        ]);

        $headAdmin = $this->makeUser('head_admin');
        $photo = UploadedFile::fake()->image('site-photo.jpg');

        $this->actingAs($headAdmin)
            ->post("/scopes/{$scope->id}/photos", [
                'photo' => $photo,
                'caption' => 'Day 1 setup',
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $this->assertDatabaseHas('scope_photos', [
            'project_scope_id' => $scope->id,
            'caption' => 'Day 1 setup',
        ]);

        $storedPath = (string) \DB::table('scope_photos')
            ->where('project_scope_id', $scope->id)
            ->value('photo_path');

        Storage::disk('public')->assertExists($storedPath);
    }

    private function makeProject(): Project
    {
        return Project::create([
            'name' => 'Monitoring Project',
            'client' => 'Client X',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
        ]);
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
}
