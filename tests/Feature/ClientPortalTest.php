<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
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
                'password_confirmation' => 'password',
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
        ])->assertRedirect('/client/portal');

        $this->assertAuthenticatedAs($client);

        $this->get('/client/portal')
            ->assertOk();
    }

    public function test_client_always_sees_progress_receipt_even_without_accomplishments(): void
    {
        $project = $this->makeProject();
        $client = User::create([
            'fullname' => 'Receipt Client',
            'email' => 'receipt.client@example.test',
            'username' => 'receipt_client',
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

        // Login and follow the redirect to /client/portal
        $this->post('/client/login', [
            'username' => 'receipt_client',
            'password' => 'password',
        ])->assertRedirect('/client/portal');

        $this->assertAuthenticatedAs($client);

        // Even with no foreman assigned and no accomplishments, the client should
        // see the progress receipt page — not fall back to Client/Dashboard.
        $this->get('/client/portal')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ProgressReceipt')
                ->has('isClientPortal')
                ->where('isClientPortal', true)
            );
    }

    public function test_client_portal_renders_receipt_inline_when_foreman_assigned(): void
    {
        $project = $this->makeProject();
        $client = User::create([
            'fullname' => 'Portal Foreman Client',
            'email' => 'portal.foreman.client@example.test',
            'username' => 'portal_foreman_client',
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

        $foreman = User::create([
            'fullname' => 'Portal Foreman',
            'email' => 'portal.foreman@example.test',
            'username' => 'portal_foreman',
            'password' => Hash::make('password'),
            'role' => 'foreman',
        ]);

        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);

        // The client portal must always render the receipt inline at /client/portal
        // even when a foreman is assigned and a submit token already exists — it
        // must NOT redirect the client away to the public /progress-receipt/{token} URL.
        $this->actingAs($client)
            ->get('/client/portal')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/ProgressReceipt')
                ->has('isClientPortal')
                ->where('isClientPortal', true)
                ->has('token')
                ->where('token', fn ($value) => $value !== '')
            );
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
