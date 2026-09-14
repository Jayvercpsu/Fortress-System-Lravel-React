<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProjectManagerApiAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_manager_can_login_with_valid_credentials(): void
    {
        $pm = User::create([
            'fullname' => 'Api PM',
            'email' => 'api.pm@example.test',
            'username' => 'api_pm',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $response = $this->postJson('/api/project-manager/login', [
            'email' => 'api.pm@example.test',
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'api.pm@example.test')
            ->assertJsonPath('user.role', User::ROLE_PROJECT_MANAGER)
            ->assertJsonPath('expires_in_minutes', 60 * 24)
            ->assertJsonStructure(['token', 'user', 'projects', 'expires_at', 'server_time']);

        $this->assertNotEmpty($response->json('token'));
        $this->assertSame($pm->id, $response->json('user.id'));

        $expiresAt = strtotime((string) $response->json('expires_at'));
        $this->assertGreaterThan(time() + (23 * 3600), $expiresAt);
        $this->assertLessThanOrEqual(time() + (25 * 3600), $expiresAt);
    }

    public function test_project_manager_login_rejects_wrong_password(): void
    {
        User::create([
            'fullname' => 'Api PM',
            'email' => 'api.pm.wrong@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $this->postJson('/api/project-manager/login', [
            'email' => 'api.pm.wrong@example.test',
            'password' => 'wrong-password',
        ])->assertStatus(422);
    }

    public function test_non_pm_role_is_rejected_on_pm_api_login(): void
    {
        User::create([
            'fullname' => 'Api Foreman',
            'email' => 'api.pm.foreman@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $this->postJson('/api/project-manager/login', [
            'email' => 'api.pm.foreman@example.test',
            'password' => 'password123',
        ])->assertForbidden();
    }

    public function test_authenticated_pm_can_fetch_profile_and_projects(): void
    {
        User::create([
            'fullname' => 'Api PM',
            'email' => 'api.pm.me@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        Project::create([
            'name' => 'PM API Project',
            'client' => 'API Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'Construction',
            'overall_progress' => 10,
        ]);

        $token = $this->postJson('/api/project-manager/login', [
            'email' => 'api.pm.me@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->getJson('/api/project-manager/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('user.email', 'api.pm.me@example.test')
            ->assertJsonCount(1, 'projects')
            ->assertJsonPath('projects.0.name', 'PM API Project');

        $this->getJson('/api/project-manager/projects', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonCount(1, 'projects');
    }

    public function test_pm_api_rejects_missing_or_invalid_token(): void
    {
        $this->getJson('/api/project-manager/me')->assertUnauthorized();
        $this->getJson('/api/project-manager/me', [
            'Authorization' => 'Bearer invalid-token',
        ])->assertUnauthorized();
    }

    public function test_pm_token_expires_after_24_hours(): void
    {
        User::create([
            'fullname' => 'Api PM',
            'email' => 'api.pm.expiry@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $token = $this->postJson('/api/project-manager/login', [
            'email' => 'api.pm.expiry@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->getJson('/api/project-manager/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->travel(25)->hours();

        $this->getJson('/api/project-manager/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }

    public function test_foreman_token_cannot_access_pm_endpoints(): void
    {
        User::create([
            'fullname' => 'Api Foreman',
            'email' => 'api.pm.cross@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $token = $this->postJson('/api/foreman/login', [
            'email' => 'api.pm.cross@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->getJson('/api/project-manager/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }

    public function test_pm_can_read_and_update_settings(): void
    {
        User::create([
            'fullname' => 'Settings PM',
            'email' => 'api.pm.settings@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $token = $this->postJson('/api/project-manager/login', [
            'email' => 'api.pm.settings@example.test',
            'password' => 'password123',
        ])->json('token');

        $headers = ['Authorization' => 'Bearer '.$token];

        $this->getJson('/api/project-manager/settings', $headers)
            ->assertOk()
            ->assertJsonPath('account.fullname', 'Settings PM')
            ->assertJsonStructure(['account', 'sex_options', 'server_time']);

        $this->putJson('/api/project-manager/settings', [
            'fullname' => 'Updated PM',
            'email' => 'api.pm.settings@example.test',
            'phone' => '09171234567',
            'address' => 'Antipolo City',
        ], $headers)
            ->assertOk()
            ->assertJsonPath('account.fullname', 'Updated PM')
            ->assertJsonPath('account.phone', '09171234567');

        $this->assertDatabaseHas('users', [
            'email' => 'api.pm.settings@example.test',
            'fullname' => 'Updated PM',
        ]);
    }

    public function test_pm_settings_update_validates_input(): void
    {
        User::create([
            'fullname' => 'Settings PM',
            'email' => 'api.pm.settings.invalid@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $token = $this->postJson('/api/project-manager/login', [
            'email' => 'api.pm.settings.invalid@example.test',
            'password' => 'password123',
        ])->json('token');

        $this->putJson('/api/project-manager/settings', [
            'fullname' => '',
            'email' => 'not-an-email',
        ], ['Authorization' => 'Bearer '.$token])->assertStatus(422);
    }

    public function test_pm_can_upload_profile_photo(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        User::create([
            'fullname' => 'Photo PM',
            'email' => 'api.pm.photo@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $token = $this->postJson('/api/project-manager/login', [
            'email' => 'api.pm.photo@example.test',
            'password' => 'password123',
        ])->json('token');

        $photo = \Illuminate\Http\UploadedFile::fake()->image('avatar.jpg', 200, 200);

        $response = $this->post('/api/project-manager/settings/photo', [
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

        $this->getJson('/api/project-manager/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('user.profile_photo_path', $path);
    }

    public function test_pm_photo_upload_rejects_non_image(): void
    {
        User::create([
            'fullname' => 'Photo PM',
            'email' => 'api.pm.photo.invalid@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_PROJECT_MANAGER,
        ]);

        $token = $this->postJson('/api/project-manager/login', [
            'email' => 'api.pm.photo.invalid@example.test',
            'password' => 'password123',
        ])->json('token');

        $file = \Illuminate\Http\UploadedFile::fake()->create('notes.txt', 10, 'text/plain');

        $this->post('/api/project-manager/settings/photo', [
            'photo' => $file,
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertStatus(422);
    }
}
