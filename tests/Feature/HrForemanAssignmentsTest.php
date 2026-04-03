<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class HrForemanAssignmentsTest extends TestCase
{
    use RefreshDatabase;

    public function test_update_foreman_restores_soft_deleted_assignment_without_duplicate_key_error(): void
    {
        $hr = $this->makeUser('hr');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject();

        $assignment = ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => ProjectAssignment::ROLE_FOREMAN,
        ]);
        $assignment->delete();

        $this->assertSoftDeleted('project_assignments', [
            'project_id' => $project->id,
            'user_id' => $foreman->id,
        ]);

        $this->actingAs($hr)
            ->patch("/hr/foremen/{$foreman->id}", [
                'fullname' => $foreman->fullname,
                'email' => $foreman->email,
                'phone' => '09170000000',
                'project_ids' => [$project->id],
            ])
            ->assertRedirect('/hr/foremen');

        $this->assertDatabaseHas('project_assignments', [
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => ProjectAssignment::ROLE_FOREMAN,
            'deleted_at' => null,
        ]);

        $this->assertSame(
            1,
            ProjectAssignment::withTrashed()
                ->where('project_id', $project->id)
                ->where('user_id', $foreman->id)
                ->count()
        );
    }

    public function test_update_foreman_reuses_existing_project_assignment_pair_even_if_role_differs(): void
    {
        $hr = $this->makeUser('hr');
        $foreman = $this->makeUser('foreman');
        $project = $this->makeProject();

        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => ProjectAssignment::ROLE_CLIENT,
        ]);

        $this->actingAs($hr)
            ->patch("/hr/foremen/{$foreman->id}", [
                'fullname' => $foreman->fullname,
                'email' => $foreman->email,
                'phone' => '09179999999',
                'project_ids' => [$project->id],
            ])
            ->assertRedirect('/hr/foremen');

        $this->assertDatabaseHas('project_assignments', [
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => ProjectAssignment::ROLE_FOREMAN,
            'deleted_at' => null,
        ]);

        $this->assertSame(
            1,
            ProjectAssignment::withTrashed()
                ->where('project_id', $project->id)
                ->where('user_id', $foreman->id)
                ->count()
        );
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
            'name' => 'Foreman Assignment Project',
            'client' => 'Client',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
        ]);
    }
}
