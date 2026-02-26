<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\ProgressSubmitToken;
use App\Models\ProgressPhoto;
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

    public function test_public_attendance_submit_stores_week_rows(): void
    {
        $token = $this->makeToken();

        $this->post("/progress-submit/{$token->token}/attendance", [
            'week_start' => '2026-02-23',
            'entries' => [
                [
                    'worker_name' => 'Worker A',
                    'worker_role' => 'Skilled Worker',
                    'days' => [
                        'mon' => 'P',
                        'tue' => 'P',
                        'wed' => 'H',
                        'thu' => '',
                        'fri' => '',
                        'sat' => '',
                        'sun' => '',
                    ],
                ],
            ],
        ])->assertRedirect("/progress-submit/{$token->token}");

        $this->assertTrue(
            Attendance::query()
                ->where('foreman_id', $token->foreman_id)
                ->where('project_id', $token->project_id)
                ->where('worker_name', 'Worker A')
                ->where('worker_role', 'Skilled Worker')
                ->whereDate('date', '2026-02-23')
                ->where('hours', 8.0)
                ->exists()
        );

        $this->assertTrue(
            Attendance::query()
                ->where('foreman_id', $token->foreman_id)
                ->where('project_id', $token->project_id)
                ->where('worker_name', 'Worker A')
                ->where('worker_role', 'Skilled Worker')
                ->whereDate('date', '2026-02-25')
                ->where('hours', 4.0)
                ->exists()
        );

        $token->refresh();
        $this->assertSame(1, (int) $token->submission_count);
    }

    public function test_public_weekly_progress_submit_stores_weekly_accomplishment_rows(): void
    {
        $token = $this->makeToken();

        $this->post("/progress-submit/{$token->token}/weekly-progress", [
            'week_start' => '2026-02-23',
            'scopes' => [
                ['scope_of_work' => 'Mobilization and Hauling', 'percent_completed' => 40],
                ['scope_of_work' => 'Foundation Preparation', 'percent_completed' => 25.5],
            ],
        ])->assertRedirect("/progress-submit/{$token->token}");

        $this->assertDatabaseHas('weekly_accomplishments', [
            'foreman_id' => $token->foreman_id,
            'project_id' => $token->project_id,
            'week_start' => '2026-02-23',
            'scope_of_work' => 'Mobilization and Hauling',
            'percent_completed' => 40.0,
        ]);

        $this->assertDatabaseHas('weekly_accomplishments', [
            'foreman_id' => $token->foreman_id,
            'project_id' => $token->project_id,
            'week_start' => '2026-02-23',
            'scope_of_work' => 'Foundation Preparation',
            'percent_completed' => 25.5,
        ]);
    }

    public function test_public_issue_report_submit_stores_issue_and_photo(): void
    {
        Storage::fake('public');
        $token = $this->makeToken();
        $photo = UploadedFile::fake()->image('issue.jpg');

        $this->post("/progress-submit/{$token->token}/issue-report", [
            'issue_title' => 'Safety rail missing',
            'description' => 'Temporary edge has no rail on second floor.',
            'urgency' => 'high',
            'photo' => $photo,
        ])->assertRedirect("/progress-submit/{$token->token}");

        $this->assertDatabaseHas('issue_reports', [
            'foreman_id' => $token->foreman_id,
            'issue_title' => 'Safety rail missing',
            'severity' => 'high',
            'status' => 'open',
        ]);

        $this->assertDatabaseHas('progress_photos', [
            'foreman_id' => $token->foreman_id,
            'project_id' => $token->project_id,
        ]);

        $storedPath = (string) ProgressPhoto::query()
            ->where('foreman_id', $token->foreman_id)
            ->where('project_id', $token->project_id)
            ->value('photo_path');

        Storage::disk('public')->assertExists($storedPath);
    }

    public function test_public_submit_all_stores_multiple_sections_with_single_submission_count_increment(): void
    {
        Storage::fake('public');
        $token = $this->makeToken();

        $this->post("/progress-submit/{$token->token}/submit-all", [
            'attendance_week_start' => '2026-02-23',
            'attendance_entries' => [
                [
                    'worker_name' => 'Worker B',
                    'worker_role' => 'Laborer',
                    'days' => [
                        'mon' => 'P',
                        'tue' => 'A',
                        'wed' => '',
                        'thu' => '',
                        'fri' => '',
                        'sat' => '',
                        'sun' => '',
                    ],
                ],
            ],
            'material_name' => 'Cement',
            'material_quantity' => '30',
            'material_unit' => 'bags',
            'material_remarks' => 'For slab work',
            'weekly_week_start' => '2026-02-23',
            'weekly_scopes' => [
                ['scope_of_work' => 'Slab on Fill', 'percent_completed' => 50],
            ],
            'issue_title' => 'Leaking pipe',
            'issue_description' => 'Temporary water line is leaking near footing.',
            'issue_urgency' => 'normal',
            'issue_photo' => UploadedFile::fake()->image('issue2.jpg'),
        ])->assertRedirect("/progress-submit/{$token->token}");

        $this->assertTrue(
            Attendance::query()
                ->where('foreman_id', $token->foreman_id)
                ->where('project_id', $token->project_id)
                ->where('worker_name', 'Worker B')
                ->whereDate('date', '2026-02-23')
                ->exists()
        );

        $this->assertDatabaseHas('material_requests', [
            'foreman_id' => $token->foreman_id,
            'material_name' => 'Cement',
            'quantity' => '30',
            'unit' => 'bags',
        ]);

        $this->assertDatabaseHas('weekly_accomplishments', [
            'foreman_id' => $token->foreman_id,
            'project_id' => $token->project_id,
            'scope_of_work' => 'Slab on Fill',
            'percent_completed' => 50.0,
        ]);

        $this->assertDatabaseHas('issue_reports', [
            'foreman_id' => $token->foreman_id,
            'issue_title' => 'Leaking pipe',
            'severity' => 'medium',
        ]);

        $token->refresh();
        $this->assertSame(1, (int) $token->submission_count);
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
