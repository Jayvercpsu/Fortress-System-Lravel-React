<?php

namespace Tests\Feature;

use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublicProgressSubmitTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_token_page_is_accessible_without_login_when_token_is_active(): void
    {
        $token = $this->makeToken();

        $this->get("/progress-submit/{$token->token}")
            ->assertOk();
    }

    public function test_public_submit_stores_project_update_and_photo_file(): void
    {
        Storage::fake('public');

        $token = $this->makeToken();
        $photo = UploadedFile::fake()->image('site-progress.jpg');

        $this->post("/progress-submit/{$token->token}", [
            'progress_note' => 'Completed slab setup for section A.',
            'photo' => $photo,
            'caption' => 'Concrete prep area',
        ])->assertRedirect("/progress-submit/{$token->token}");

        $this->assertDatabaseHas('project_updates', [
            'project_id' => $token->project_id,
            'created_by' => $token->foreman_id,
        ]);

        $this->assertDatabaseHas('project_files', [
            'project_id' => $token->project_id,
            'uploaded_by' => $token->foreman_id,
        ]);

        $storedPath = (string) \DB::table('project_files')
            ->where('project_id', $token->project_id)
            ->value('file_path');

        Storage::disk('public')->assertExists($storedPath);

        $token->refresh();
        $this->assertSame(1, (int) $token->submission_count);
        $this->assertNotNull($token->last_submitted_at);
    }

    public function test_public_submit_rejects_expired_token(): void
    {
        $token = $this->makeToken(expiresAt: now()->subMinute());

        $this->get("/progress-submit/{$token->token}")
            ->assertNotFound();

        $this->post("/progress-submit/{$token->token}", [
            'progress_note' => 'Should fail',
            'photo' => UploadedFile::fake()->image('blocked.jpg'),
        ])->assertNotFound();
    }

    private function makeToken($expiresAt = null): ProgressSubmitToken
    {
        $foreman = User::create([
            'fullname' => 'Foreman Public',
            'email' => 'foreman_public_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => 'foreman',
        ]);

        $project = Project::create([
            'name' => 'Public Form Project',
            'client' => 'Client Public',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => $foreman->fullname,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
        ]);

        return ProgressSubmitToken::create([
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'token' => 'pst_' . bin2hex(random_bytes(16)),
            'expires_at' => $expiresAt,
        ]);
    }
}
