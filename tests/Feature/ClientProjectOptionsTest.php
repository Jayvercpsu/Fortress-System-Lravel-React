<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ClientProjectOptionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_clients_project_options_are_filtered_for_regular_head_admin(): void
    {
        [$regularHead, , , , $legacyProject, $ownerProject, $ownProject, $masterProject] = $this->seedData();

        $response = $this->actingAs($regularHead)->get('/clients');

        $response
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('HeadAdmin/Clients/Index')
                ->has('projectOptions'));

        $this->assertOptionNames(
            $response->inertiaProps('projectOptions'),
            ['Regular Own Project'],
            [$legacyProject->name, $ownerProject->name, $masterProject->name]
        );
    }

    public function test_clients_project_options_include_legacy_and_master_admin_projects_for_special_head_admin(): void
    {
        [, $special, , , $legacyProject, $ownerProject, , $masterProject] = $this->seedData();

        $response = $this->actingAs($special)->get('/clients');

        $response
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('HeadAdmin/Clients/Index')
                ->has('projectOptions'));

        $this->assertOptionNames(
            $response->inertiaProps('projectOptions'),
            [$legacyProject->name, $masterProject->name],
            [$ownerProject->name]
        );
    }

    private function assertOptionNames(array $options, array $expected, array $hidden): bool
    {
        $names = collect($options)->pluck('name')->map(fn ($name) => trim((string) $name))->values();

        foreach ($expected as $name) {
            $this->assertTrue($names->contains($name), "Expected option '{$name}' to be present.");
        }

        foreach ($hidden as $name) {
            $this->assertFalse($names->contains($name), "Option '{$name}' should not be present.");
        }

        return true;
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

        return [$regularHead, $special, $owner, $master, $legacyProject, $ownerProject, $ownProject, $masterProject];
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