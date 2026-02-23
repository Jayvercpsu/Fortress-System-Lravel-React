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

class ProgressPhotosFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_foreman_can_upload_optional_proof_photo_from_dashboard_flow(): void
    {
        Storage::fake('public');

        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject();
        $scope = ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Foundation Preparation',
            'assigned_personnel' => $foreman->fullname,
            'progress_percent' => 10,
            'status' => 'IN_PROGRESS',
            'remarks' => null,
        ]);
        $photo = UploadedFile::fake()->image('proof.jpg');

        $this->actingAs($foreman)
            ->post('/foreman/progress-photo', [
                'project_id' => $project->id,
                'scope_id' => $scope->id,
                'caption' => 'Installed beam supports.',
                'photo' => $photo,
            ])
            ->assertStatus(302);

        $this->assertDatabaseHas('progress_photos', [
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'caption' => 'Installed beam supports.',
        ]);
        $this->assertDatabaseHas('scope_photos', [
            'project_scope_id' => $scope->id,
            'caption' => 'Installed beam supports.',
        ]);

        $storedPath = (string) \DB::table('progress_photos')
            ->where('foreman_id', $foreman->id)
            ->value('photo_path');

        Storage::disk('public')->assertExists($storedPath);
    }

    public function test_admin_and_head_admin_can_view_all_foreman_progress_photos_page(): void
    {
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject();
        \DB::table('progress_photos')->insert([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'photo_path' => 'progress-photos/sample.jpg',
            'caption' => 'Sample proof',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($this->makeUser('admin'))
            ->get('/progress-photos')
            ->assertOk();

        $this->actingAs($this->makeUser('head_admin'))
            ->get('/progress-photos')
            ->assertOk();
    }

    public function test_hr_and_foreman_cannot_open_progress_photos_page(): void
    {
        $this->actingAs($this->makeUser('hr'))
            ->get('/progress-photos')
            ->assertForbidden();

        $this->actingAs($this->makeUser('foreman'))
            ->get('/progress-photos')
            ->assertForbidden();
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

    private function makeProject(): Project
    {
        return Project::create([
            'name' => 'Proof Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
        ]);
    }
}
