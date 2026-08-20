<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ClientTableVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_clients_table_is_filtered_for_regular_head_admin(): void
    {
        [$regularHead, , , $legacyProject, $ownerProject, $ownProject, $masterProject] = $this->seedData();

        $response = $this->actingAs($regularHead)->get('/clients');

        $response
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('HeadAdmin/Clients/Index')
                ->has('clients'));

        $this->assertClientNames(
            $response->inertiaProps('clients'),
            ['Client Own'],
            ['Client Legacy', 'Client Owner', 'Client Master', 'Client Unassigned']
        );
    }

    public function test_clients_table_includes_legacy_master_and_unassigned_clients_for_special_head_admin(): void
    {
        [, $special, , $legacyProject, $ownerProject, $ownProject, $masterProject] = $this->seedData();

        $response = $this->actingAs($special)->get('/clients');

        $response
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('HeadAdmin/Clients/Index')
                ->has('clients'));

        $this->assertClientNames(
            $response->inertiaProps('clients'),
            ['Client Legacy', 'Client Master', 'Client Unassigned'],
            ['Client Owner']
        );
    }

    private function assertClientNames(array $clients, array $expected, array $hidden): void
    {
        $names = collect($clients)->pluck('fullname')->values();

        foreach ($expected as $name) {
            $this->assertTrue($names->contains($name), "Expected client '{$name}' to be present.");
        }

        foreach ($hidden as $name) {
            $this->assertFalse($names->contains($name), "Client '{$name}' should not be present.");
        }
    }

    private function seedData(): array
    {
        $regularHead = $this->makeUser('head_admin');
        $special = User::create([
            'fullname' => 'Head Admin',
            'email' => User::LEGACY_PROJECT_ACCESS_EMAIL,
            'password' => Hash::make('password'),
            'role' => 'head_admin',
        ]);
        $owner = $this->makeUser('head_admin');
        $master = $this->makeUser('master_admin');

        $legacyProject = $this->makeProject('Legacy Client Project', null);
        $ownerProject = $this->makeProject('Owner Secret Client Project', $owner->id);
        $ownProject = $this->makeProject('Regular Own Project', $regularHead->id);
        $masterProject = $this->makeProject('Master Admin Project', $master->id);

        $this->makeClient('Client Legacy', $legacyProject);
        $this->makeClient('Client Owner', $ownerProject);
        $this->makeClient('Client Own', $ownProject);
        $this->makeClient('Client Master', $masterProject);
        $this->makeClient('Client Unassigned', null);

        return [$regularHead, $special, $owner, $legacyProject, $ownerProject, $ownProject, $masterProject];
    }

    private function makeClient(string $name, ?Project $project): void
    {
        $client = User::create([
            'fullname' => $name,
            'email' => strtolower(str_replace(' ', '_', $name)) . uniqid() . '@example.test',
            'username' => strtolower(str_replace(' ', '_', $name)),
            'password' => Hash::make('password'),
            'role' => 'client',
        ]);

        if ($project) {
            ProjectAssignment::create([
                'project_id' => $project->id,
                'user_id' => $client->id,
                'role_in_project' => 'client',
            ]);
        }
    }

    private function makeProject(string $name, ?int $userId): Project
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
            'user_id' => $userId,
        ]);
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
}