<?php

namespace Tests\Feature;

use App\Models\DesignProject;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProjectOwnershipTest extends TestCase
{
    use RefreshDatabase;

    public function test_master_admin_sees_every_project(): void
    {
        $master = $this->makeUser('master_admin');
        $special = $this->makeUser('head_admin', User::LEGACY_PROJECT_ACCESS_EMAIL);
        $second = $this->makeUser('head_admin');

        $this->makeProject('Legacy Alpha', null);
        $this->makeProject('Master Owned', $master->id);
        $this->makeProject('Special Owned', $special->id);
        $this->makeProject('Second Owned', $second->id);

        $this->actingAs($master)
            ->get('/projects')
            ->assertOk()
            ->assertSee('Legacy Alpha')
            ->assertSee('Master Owned')
            ->assertSee('Special Owned')
            ->assertSee('Second Owned');
    }

    public function test_regular_head_admin_sees_only_their_own_projects(): void
    {
        $master = $this->makeUser('master_admin');
        $special = $this->makeUser('head_admin', User::LEGACY_PROJECT_ACCESS_EMAIL);
        $second = $this->makeUser('head_admin');

        $this->makeProject('Legacy Alpha', null);
        $this->makeProject('Master Owned', $master->id);
        $this->makeProject('Special Owned', $special->id);
        $this->makeProject('Second Owned', $second->id);

        $this->actingAs($second)
            ->get('/projects')
            ->assertOk()
            ->assertSee('Second Owned')
            ->assertDontSee('Legacy Alpha')
            ->assertDontSee('Master Owned')
            ->assertDontSee('Special Owned');
    }

    public function test_special_head_admin_sees_own_legacy_and_master_admin_projects(): void
    {
        $master = $this->makeUser('master_admin');
        $special = $this->makeUser('head_admin', User::LEGACY_PROJECT_ACCESS_EMAIL);
        $second = $this->makeUser('head_admin');

        $this->makeProject('Legacy Alpha', null);
        $this->makeProject('Master Owned', $master->id);
        $this->makeProject('Special Owned', $special->id);
        $this->makeProject('Second Owned', $second->id);

        $this->actingAs($special)
            ->get('/projects')
            ->assertOk()
            ->assertSee('Legacy Alpha')
            ->assertSee('Master Owned')
            ->assertSee('Special Owned')
            ->assertDontSee('Second Owned');
    }

    public function test_storing_a_project_stamps_the_acting_user_as_owner(): void
    {
        $headAdmin = $this->makeUser('head_admin');

        $this->actingAs($headAdmin)->post('/projects', [
            'name' => 'Owned Project',
            'client' => 'Client A',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => null,
            'target' => '2026-12-31',
            'status' => 'PLANNING',
            'phase' => 'Design',
        ])->assertRedirect();

        $this->assertDatabaseHas('projects', [
            'name' => 'Owned Project',
            'user_id' => $headAdmin->id,
        ]);
    }

    public function test_regular_head_admin_cannot_open_another_head_admins_project(): void
    {
        $master = $this->makeUser('master_admin');
        $special = $this->makeUser('head_admin', User::LEGACY_PROJECT_ACCESS_EMAIL);
        $second = $this->makeUser('head_admin');

        $legacy = $this->makeProject('Legacy Alpha', null);
        $masterProject = $this->makeProject('Master Owned', $master->id);
        $specialProject = $this->makeProject('Special Owned', $special->id);

        $this->actingAs($second)
            ->get("/projects/{$legacy->id}")
            ->assertNotFound();

        $this->actingAs($second)
            ->get("/projects/{$masterProject->id}/edit")
            ->assertNotFound();

        $this->actingAs($second)
            ->get("/projects/{$specialProject->id}")
            ->assertNotFound();

        $this->actingAs($master)
            ->get("/projects/{$specialProject->id}")
            ->assertOk();
    }

    public function test_transfer_to_construction_duplicate_inherits_the_owner(): void
    {
        $headAdmin = $this->makeUser('head_admin');

        $project = $this->makeProject('Transfer Owner', $headAdmin->id, 'Design');

        DesignProject::query()
            ->where('project_id', $project->id)
            ->update([
                'design_contract_amount' => 100000,
                'total_received' => 100000,
                'design_progress' => 100,
                'client_approval_status' => 'approved',
            ]);

        $this->actingAs($headAdmin)
            ->patch("/projects/{$project->id}/transfer-to-construction")
            ->assertRedirect('/projects');

        $duplicate = Project::query()->where('source_project_id', $project->id)->firstOrFail();

        $this->assertSame('Construction', $duplicate->phase);
        $this->assertSame($headAdmin->id, (int) $duplicate->user_id);
    }

    private function makeProject(string $name, ?int $userId, string $phase = 'Construction'): Project
    {
        return Project::create([
            'name' => $name,
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'City',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => $phase,
            'overall_progress' => 0,
            'user_id' => $userId,
        ]);
    }

    private function makeUser(string $role, ?string $email = null): User
    {
        return User::create([
            'fullname' => ucfirst($role) . ' User',
            'email' => $email ?? $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }
}