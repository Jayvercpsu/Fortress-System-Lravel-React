<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ForemanApiAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_foreman_can_login_with_valid_credentials(): void
    {
        $foreman = User::create([
            'fullname' => 'Api Foreman',
            'email' => 'api.foreman@example.test',
            'username' => 'api_foreman',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $response = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman@example.test',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'api.foreman@example.test')
            ->assertJsonPath('user.role', User::ROLE_FOREMAN)
            ->assertJsonPath('expires_in_minutes', 60 * 24)
            ->assertJsonStructure(['token', 'user', 'projects', 'expires_at', 'server_time']);

        $this->assertNotEmpty($response->json('token'));
        $this->assertSame($foreman->id, $response->json('user.id'));

        $expiresAt = strtotime((string) $response->json('expires_at'));
        $this->assertGreaterThan(time() + (23 * 3600), $expiresAt);
        $this->assertLessThanOrEqual(time() + (25 * 3600), $expiresAt);
    }

    public function test_foreman_login_rejects_wrong_password(): void
    {
        User::create([
            'fullname' => 'Api Foreman',
            'email' => 'api.foreman.wrong@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.wrong@example.test',
            'password' => 'wrong-password',
        ])->assertStatus(422);
    }

    public function test_non_foreman_role_is_rejected_on_foreman_api_login(): void
    {
        User::create([
            'fullname' => 'Admin User',
            'email' => 'api.admin@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_ADMIN,
        ]);

        $this->postJson('/api/foreman/login', [
            'email' => 'api.admin@example.test',
            'password' => 'password123',
        ])->assertForbidden();
    }

    public function test_authenticated_foreman_can_fetch_profile_and_projects(): void
    {
        $foreman = User::create([
            'fullname' => 'Api Foreman',
            'email' => 'api.foreman.me@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = Project::create([
            'name' => 'Foreman API Project',
            'client' => 'API Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 10,
        ]);

        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.me@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->getJson('/api/foreman/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('user.email', 'api.foreman.me@example.test')
            ->assertJsonCount(1, 'projects')
            ->assertJsonPath('projects.0.name', 'Foreman API Project');

        $this->getJson('/api/foreman/projects', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonCount(1, 'projects');
    }

    public function test_foreman_api_rejects_missing_or_invalid_token(): void
    {
        $this->getJson('/api/foreman/me')->assertUnauthorized();
        $this->getJson('/api/foreman/me', [
            'Authorization' => 'Bearer invalid-token',
        ])->assertUnauthorized();
    }

    public function test_foreman_stats_returns_homepage_counts(): void
    {
        $foreman = User::create([
            'fullname' => 'Stats Foreman',
            'email' => 'api.foreman.stats@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = Project::create([
            'name' => 'Stats Project',
            'client' => 'Stats Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 0,
        ]);

        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.stats@example.test',
            'password' => 'password123',
        ])->json('token');
        $headers = ['Authorization' => 'Bearer '.$token];

        // Empty at first.
        $this->getJson('/api/foreman/stats', $headers)
            ->assertOk()
            ->assertJsonPath('assigned_projects', 1)
            ->assertJsonPath('attendance_logs', 0)
            ->assertJsonPath('pending_materials', 0)
            ->assertJsonPath('open_issues', 0)
            ->assertJsonPath('deliveries', 0);

        \App\Models\Attendance::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'worker_name' => 'Site Worker',
            'worker_role' => 'Mason',
            'date' => now()->toDateString(),
            'hours' => 8,
            'attendance_code' => 'P',
        ]);
        \App\Models\Attendance::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'worker_name' => 'Site Worker 2',
            'worker_role' => 'Laborer',
            'date' => now()->toDateString(),
            'hours' => 4,
            'attendance_code' => 'H',
        ]);
        // Another foreman's rows must not leak in.
        $other = User::create([
            'fullname' => 'Other Foreman',
            'email' => 'api.foreman.stats.other@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);
        \App\Models\Attendance::create([
            'foreman_id' => $other->id,
            'project_id' => $project->id,
            'worker_name' => 'Other Worker',
            'worker_role' => 'Mason',
            'date' => now()->toDateString(),
            'hours' => 8,
            'attendance_code' => 'P',
        ]);

        \App\Models\MaterialRequest::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'material_name' => 'Cement',
            'quantity' => '10',
            'unit' => 'bags',
            'status' => 'pending',
        ]);
        \App\Models\IssueReport::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'issue_title' => 'Blocked road',
            'description' => 'Truck blocking access',
            'severity' => 'high',
            'status' => 'open',
        ]);
        \App\Models\DeliveryConfirmation::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'item_delivered' => 'Cement',
            'quantity' => '50',
            'delivery_date' => now()->toDateString(),
            'status' => 'received',
        ]);

        $this->getJson('/api/foreman/stats', $headers)
            ->assertOk()
            ->assertJsonPath('assigned_projects', 1)
            ->assertJsonPath('attendance_logs', 2)
            ->assertJsonPath('pending_materials', 1)
            ->assertJsonPath('open_issues', 1)
            ->assertJsonPath('deliveries', 1);

        $this->getJson('/api/foreman/stats')->assertUnauthorized();
    }

    public function test_server_time_endpoint_is_public(): void
    {
        $this->getJson('/api/server-time')
            ->assertOk()
            ->assertJsonStructure(['server_time', 'timestamp', 'timezone']);
    }

    public function test_foreman_token_expires_after_24_hours(): void
    {
        User::create([
            'fullname' => 'Api Foreman',
            'email' => 'api.foreman.expiry@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.expiry@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->getJson('/api/foreman/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->travel(25)->hours();

        $this->getJson('/api/foreman/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }

    public function test_foreman_can_read_and_update_settings(): void
    {
        User::create([
            'fullname' => 'Settings Foreman',
            'email' => 'api.foreman.settings@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.settings@example.test',
            'password' => 'password123',
        ])->json('token');

        $headers = ['Authorization' => 'Bearer '.$token];

        $this->getJson('/api/foreman/settings', $headers)
            ->assertOk()
            ->assertJsonPath('account.fullname', 'Settings Foreman')
            ->assertJsonStructure(['account', 'sex_options', 'server_time']);

        $this->putJson('/api/foreman/settings', [
            'fullname' => 'Updated Foreman',
            'email' => 'api.foreman.settings@example.test',
            'phone' => '09171234567',
            'address' => 'Antipolo City',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('account.fullname', 'Updated Foreman')
            ->assertJsonPath('account.phone', '09171234567');

        $this->assertDatabaseHas('users', [
            'email' => 'api.foreman.settings@example.test',
            'fullname' => 'Updated Foreman',
        ]);
    }

    public function test_foreman_settings_update_validates_input(): void
    {
        User::create([
            'fullname' => 'Settings Foreman',
            'email' => 'api.foreman.settings.invalid@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.settings.invalid@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->putJson('/api/foreman/settings', [
            'fullname' => '',
            'email' => 'not-an-email',
        ], ['Authorization' => 'Bearer '.$token])->assertStatus(422);
    }

    public function test_foreman_jotform_returns_project_data_for_assigned_project(): void
    {
        $foreman = User::create([
            'fullname' => 'Jotform Foreman',
            'email' => 'api.foreman.jotform@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = Project::create([
            'name' => 'Jotform API Project',
            'client' => 'API Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 10,
        ]);

        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);

        \App\Models\Worker::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'name' => 'Site Worker',
            'job_type' => 'Mason',
        ]);

        \App\Models\ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Foundation',
            'progress_percent' => 25,
            'status' => 'IN_PROGRESS',
            'assigned_personnel' => 'Jotform Foreman',
        ]);

        $monday = \Illuminate\Support\Carbon::now('Asia/Manila')->startOfWeek(\Carbon\Carbon::MONDAY);

        \App\Models\Attendance::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'worker_name' => 'Site Worker',
            'worker_role' => 'Mason',
            'date' => $monday->toDateString(),
            'hours' => 8,
            'attendance_code' => 'P',
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.jotform@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->getJson("/api/foreman/projects/{$project->id}/jotform", [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('project.name', 'Jotform API Project')
            ->assertJsonPath('foreman_name', 'Jotform Foreman')
            ->assertJsonCount(1, 'workers')
            ->assertJsonPath('workers.0.name', 'Site Worker')
            ->assertJsonCount(1, 'scopes')
            ->assertJsonPath('scopes.0.scope_name', 'Foundation')
            ->assertJsonCount(1, 'attendance_current_week')
            ->assertJsonPath('attendance_current_week.0.worker_name', 'Site Worker')
            ->assertJsonPath('attendance_current_week.0.days.mon', 'P')
            ->assertJsonStructure([
                'project',
                'current_date',
                'current_week_start',
                'foreman_name',
                'workers',
                'scopes',
                'weekly_scope_defaults_enabled',
                'weekly_fallback_scopes',
                'attendance_current_week',
                'attendance_saved_by_week',
                'weekly_current_week',
                'weekly_saved_by_week',
                'recent_deliveries',
                'recent_material_requests',
                'recent_issue_reports',
                'recent_photos',
                'scope_photo_map',
                'meta',
            ]);
    }

    public function test_foreman_jotform_rejects_unassigned_project(): void
    {
        User::create([
            'fullname' => 'Jotform Foreman',
            'email' => 'api.foreman.jotform.denied@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = Project::create([
            'name' => 'Other Project',
            'client' => 'Other Client',
            'type' => 'Residential',
            'location' => 'Pasig City',
            'status' => 'ONGOING',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 0,
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.jotform.denied@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->getJson("/api/foreman/projects/{$project->id}/jotform", [
            'Authorization' => 'Bearer '.$token,
        ])->assertForbidden();
    }

    public function test_foreman_can_upload_profile_photo(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        User::create([
            'fullname' => 'Photo Foreman',
            'email' => 'api.foreman.photo@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.photo@example.test',
            'password' => 'password123',
        ])->json('token');

        $photo = \Illuminate\Http\UploadedFile::fake()->image('avatar.jpg', 200, 200);

        $response = $this->post('/api/foreman/settings/photo', [
            'photo' => $photo,
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['profile_photo_path', 'profile_photo_url', 'account']);

        $path = (string) $response->json('profile_photo_path');
        $this->assertNotEmpty($path);
        $this->assertStringContainsString('/files/', (string) $response->json('profile_photo_url'));

        $this->assertDatabaseHas('user_details', [
            'profile_photo_path' => $path,
        ]);

        $this->getJson('/api/foreman/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('user.profile_photo_path', $path);
    }

    public function test_foreman_photo_upload_rejects_non_image(): void
    {
        User::create([
            'fullname' => 'Photo Foreman',
            'email' => 'api.foreman.photo.invalid@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.photo.invalid@example.test',
            'password' => 'password123',
        ])->json('token');

        $file = \Illuminate\Http\UploadedFile::fake()->create('notes.txt', 10, 'text/plain');

        $this->post('/api/foreman/settings/photo', [
            'photo' => $file,
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertStatus(422);
    }

    public function test_recent_photos_excludes_section_uploads_like_web(): void
    {
        $foreman = User::create([
            'fullname' => 'Photo Filter Foreman',
            'email' => 'api.foreman.photo.filter@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = Project::create([
            'name' => 'Photo Filter Project',
            'client' => 'Filter Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 0,
        ]);

        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);

        \App\Models\ProgressPhoto::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'photo_path' => 'filter/delivery.jpg',
            'caption' => '[Delivery] Complete',
        ]);
        \App\Models\ProgressPhoto::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'photo_path' => 'filter/material.jpg',
            'caption' => '[Material] Cement',
        ]);
        \App\Models\ProgressPhoto::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'photo_path' => 'filter/issue.jpg',
            'caption' => '[Issue] Blocked road',
        ]);
        \App\Models\ProgressPhoto::create([
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'photo_path' => 'filter/progress.jpg',
            'caption' => '[Masonry] Wall progress',
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.photo.filter@example.test',
            'password' => 'password123',
        ])->json('token');

        $response = $this->getJson("/api/foreman/projects/{$project->id}/jotform", [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonCount(1, 'recent_photos')
            ->assertJsonPath('recent_photos.0.photo_path', 'filter/progress.jpg');
    }

    public function test_jotform_lists_only_scopes_assigned_to_foreman(): void
    {
        $foreman = User::create([
            'fullname' => 'Scope Foreman',
            'email' => 'api.foreman.scopes@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = Project::create([
            'name' => 'Scope Project',
            'client' => 'Scope Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 0,
        ]);

        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);

        \App\Models\ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Assigned Scope',
            'progress_percent' => 10,
            'status' => 'IN_PROGRESS',
            'assigned_personnel' => 'Scope Foreman',
        ]);
        \App\Models\ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Unassigned Scope',
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
            'assigned_personnel' => null,
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.scopes@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->getJson("/api/foreman/projects/{$project->id}/jotform", [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonCount(2, 'scopes')
            ->assertJsonPath('scopes.0.scope_name', 'Assigned Scope')
            ->assertJsonPath('scopes.1.scope_name', 'Unassigned Scope')
            ->assertJsonPath('weekly_scope_defaults_enabled', false);
    }

    public function test_jotform_enables_fallback_scopes_when_project_has_none(): void
    {
        $foreman = User::create([
            'fullname' => 'Fallback Foreman',
            'email' => 'api.foreman.fallback@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = Project::create([
            'name' => 'No Scope Project',
            'client' => 'No Scope Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 0,
        ]);

        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.foreman.fallback@example.test',
            'password' => 'password123',
        ])->json('token');

        $response = $this->getJson("/api/foreman/projects/{$project->id}/jotform", [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertOk()
            ->assertJsonCount(0, 'scopes')
            ->assertJsonPath('weekly_scope_defaults_enabled', true);

        $this->assertNotEmpty($response->json('weekly_fallback_scopes'));
    }

    private function makeAiForeman(string $email): User
    {
        return User::create([
            'fullname' => 'AI Foreman',
            'email' => $email,
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);
    }

    private function makeAiProject(): Project
    {
        return Project::create([
            'name' => 'AI Project',
            'client' => 'AI Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 0,
        ]);
    }

    private function aiLogin(string $email): string
    {
        return (string) $this->postJson('/api/foreman/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('token');
    }

    public function test_ai_scan_rejects_unassigned_project(): void
    {
        $this->makeAiForeman('api.foreman.ai.denied@example.test');
        $project = $this->makeAiProject();
        $token = $this->aiLogin('api.foreman.ai.denied@example.test');

        $this->post("/api/foreman/projects/{$project->id}/ai-attendance/scan", [], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertForbidden();
    }

    public function test_ai_scan_requires_images(): void
    {
        $foreman = $this->makeAiForeman('api.foreman.ai.noimg@example.test');
        $project = $this->makeAiProject();
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);
        $token = $this->aiLogin('api.foreman.ai.noimg@example.test');

        $this->post("/api/foreman/projects/{$project->id}/ai-attendance/scan", [], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertStatus(422);
    }

    public function test_ai_confirm_and_reject_enforce_record_ownership(): void
    {
        $owner = $this->makeAiForeman('api.foreman.ai.owner@example.test');
        $other = $this->makeAiForeman('api.foreman.ai.other@example.test');
        $project = $this->makeAiProject();

        $record = \App\Models\ProcessedRecord::create([
            'project_id' => $project->id,
            'user_id' => $owner->id,
            'record_type' => 'general',
            'status' => 'pending',
        ]);

        $ownerToken = $this->aiLogin('api.foreman.ai.owner@example.test');
        $otherToken = $this->aiLogin('api.foreman.ai.other@example.test');

        $this->post("/api/foreman/ai-attendance/records/{$record->id}/confirm", [], [
            'Authorization' => 'Bearer '.$otherToken,
            'Accept' => 'application/json',
        ])->assertNotFound();

        $this->post("/api/foreman/ai-attendance/records/{$record->id}/reject", [], [
            'Authorization' => 'Bearer '.$otherToken,
            'Accept' => 'application/json',
        ])->assertNotFound();

        $this->post("/api/foreman/ai-attendance/records/{$record->id}/confirm", [], [
            'Authorization' => 'Bearer '.$ownerToken,
            'Accept' => 'application/json',
        ])->assertOk();

        $this->assertSame(
            'submitted',
            \App\Models\ProcessedRecord::find($record->id)->status
        );
    }

    public function test_ai_reject_deletes_own_record(): void
    {
        $owner = $this->makeAiForeman('api.foreman.ai.reject@example.test');
        $project = $this->makeAiProject();

        $record = \App\Models\ProcessedRecord::create([
            'project_id' => $project->id,
            'user_id' => $owner->id,
            'record_type' => 'general',
            'status' => 'pending',
        ]);

        $token = $this->aiLogin('api.foreman.ai.reject@example.test');

        $this->post("/api/foreman/ai-attendance/records/{$record->id}/reject", [], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('message', 'Record rejected');

        $this->assertNull(\App\Models\ProcessedRecord::find($record->id));
    }
}
