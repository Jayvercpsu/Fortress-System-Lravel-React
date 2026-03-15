<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ClientPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_can_create_client_with_project_assignment(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $project = $this->makeProject();

        $this->actingAs($headAdmin)
            ->post('/clients', [
                'client_name' => 'Sample Client',
                'project_id' => $project->id,
                'location' => 'Quezon City',
                'email' => 'client.create@example.test',
                'phone' => '09171234567',
                'username' => 'client_create',
                'password' => 'password',
            ])
            ->assertRedirect('/clients');

        $client = User::query()->where('email', 'client.create@example.test')->first();

        $this->assertNotNull($client);
        $this->assertSame('client', $client->role);
        $this->assertSame('client_create', $client->username);
        $this->assertSame('09171234567', $client->detail?->phone);
        $this->assertSame('Quezon City', $client->detail?->address);

        $this->assertDatabaseHas('project_assignments', [
            'user_id' => $client->id,
            'role_in_project' => 'client',
        ]);
    }

    public function test_client_login_route_authenticates_client_username_and_redirects_to_client_dashboard(): void
    {
        $project = $this->makeProject();
        $client = User::create([
            'fullname' => 'Portal Client',
            'email' => 'portal.client@example.test',
            'username' => 'portal_client',
            'password' => Hash::make('password'),
            'role' => 'client',
        ]);
        $client->detail()->create([
            'phone' => '09991234567',
            'address' => 'Makati City',
        ]);

        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $client->id,
            'role_in_project' => 'client',
        ]);

        $this->post('/client/login', [
            'username' => 'portal_client',
            'password' => 'password',
        ])->assertRedirect('/client');

        $this->assertAuthenticatedAs($client);

        $this->get('/client')
            ->assertOk();
    }

    public function test_non_client_credentials_are_rejected_on_client_login_route(): void
    {
        User::create([
            'fullname' => 'Admin User',
            'email' => 'admin.client.login@example.test',
            'username' => 'admin_user',
            'password' => Hash::make('password'),
            'role' => 'admin',
        ]);

        $this->post('/client/login', [
            'username' => 'admin_user',
            'password' => 'password',
        ])->assertSessionHasErrors('username');

        $this->assertGuest();
    }

    private function makeUser(string $role): User
    {
        return User::create([
            'fullname' => ucfirst(str_replace('_', ' ', $role)) . ' User',
            'email' => $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }

    private function makeProject(): Project
    {
        return Project::create([
            'name' => 'Client Portal Project',
            'client' => 'Client Name',
            'type' => 'Residential',
            'location' => 'Quezon City',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
        ]);
    }
}
