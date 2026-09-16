<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\User;
use App\Services\UserService;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserServiceTest extends TestCase
{
    use RefreshDatabase;

    private UserService $userService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->userService = new UserService(app(UserRepositoryInterface::class));
    }

    public function test_create_user_includes_created_by(): void
    {
        $validated = [
            'fullname' => 'Test User',
            'email' => 'test_' . uniqid() . '@example.test',
            'password' => 'password',
            'role' => User::ROLE_CLIENT,
            'created_by' => 1,
        ];

        $this->userService->createUser($validated);

        $user = User::where('email', $validated['email'])->first();
        $this->assertNotNull($user);
        $this->assertEquals(1, $user->created_by);
    }

    public function test_create_user_without_created_by(): void
    {
        $validated = [
            'fullname' => 'Test User',
            'email' => 'test2_' . uniqid() . '@example.test',
            'password' => 'password',
            'role' => User::ROLE_CLIENT,
        ];

        $this->userService->createUser($validated);

        $user = User::where('email', $validated['email'])->first();
        $this->assertNotNull($user);
        $this->assertNull($user->created_by);
    }

    public function test_rename_syncs_denormalized_assignment_names(): void
    {
        $foreman = User::create([
            'fullname' => 'Foreman',
            'email' => 'rename.foreman@example.test',
            'password' => Hash::make('password'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = Project::create([
            'name' => 'Rename Project',
            'client' => 'Rename Client',
            'type' => 'Residential',
            'location' => 'QC',
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
            'assigned' => 'Foreman',
        ]);

        $scope = ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Foundation',
            'progress_percent' => 0,
            'status' => 'NOT_STARTED',
            'assigned_personnel' => 'Foreman',
        ]);

        // Similar-but-different names must survive untouched.
        $otherProject = Project::create([
            'name' => 'Other Rename Project',
            'client' => 'Rename Client',
            'type' => 'Residential',
            'location' => 'QC',
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
            'assigned' => 'Foreman Joe',
        ]);

        $this->userService->updateUser($foreman, [
            'fullname' => 'Joshua Foreman',
            'email' => 'rename.foreman@example.test',
            'role' => User::ROLE_FOREMAN,
        ]);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'assigned' => 'Joshua Foreman',
        ]);
        $this->assertDatabaseHas('project_scopes', [
            'id' => $scope->id,
            'assigned_personnel' => 'Joshua Foreman',
        ]);
        $this->assertDatabaseHas('projects', [
            'id' => $otherProject->id,
            'assigned' => 'Foreman Joe',
        ]);
    }

    public function test_update_without_rename_leaves_assignment_names_alone(): void
    {
        $foreman = User::create([
            'fullname' => 'Steady Foreman',
            'email' => 'steady.foreman@example.test',
            'password' => Hash::make('password'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $project = Project::create([
            'name' => 'Steady Project',
            'client' => 'Steady Client',
            'type' => 'Residential',
            'location' => 'QC',
            'status' => 'ACTIVE',
            'phase' => 'Construction',
            'overall_progress' => 0,
            'assigned' => 'Steady Foreman',
        ]);

        $this->userService->updateUser($foreman, [
            'fullname' => 'Steady Foreman',
            'email' => 'steady.changed@example.test',
            'role' => User::ROLE_FOREMAN,
        ]);

        $this->assertDatabaseHas('projects', [
            'id' => $project->id,
            'assigned' => 'Steady Foreman',
        ]);
    }
}