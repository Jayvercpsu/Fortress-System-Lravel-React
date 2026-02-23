<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RouteVisibilityRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_foreman_visibility_is_limited_to_dashboard_and_dashboard_actions(): void
    {
        $foreman = $this->makeUser('foreman');

        $this->actingAs($foreman)
            ->get('/foreman')
            ->assertOk();

        $this->actingAs($foreman)
            ->get('/settings')
            ->assertForbidden();

        $this->actingAs($foreman)
            ->get('/foreman/attendance')
            ->assertNotFound();

        $this->actingAs($foreman)
            ->get('/foreman/workers')
            ->assertNotFound();

        $this->actingAs($foreman)
            ->get('/attendance')
            ->assertForbidden();

        $this->actingAs($foreman)
            ->get('/projects')
            ->assertForbidden();

        $this->actingAs($foreman)
            ->post('/foreman/submit-all', [])
            ->assertStatus(302);
    }

    public function test_admin_and_hr_visibility_matrix_matches_policy(): void
    {
        $project = $this->makeProject();

        $this->actingAs($this->makeUser('admin'))
            ->get('/projects')
            ->assertOk();

        $this->actingAs($this->makeUser('admin'))
            ->get('/attendance')
            ->assertOk();

        $this->actingAs($this->makeUser('admin'))
            ->get("/projects/{$project->id}/monitoring")
            ->assertOk();

        $this->actingAs($this->makeUser('admin'))
            ->get("/projects/{$project->id}/expenses")
            ->assertForbidden();

        $this->actingAs($this->makeUser('admin'))
            ->get('/payroll/run')
            ->assertForbidden();

        $this->actingAs($this->makeUser('admin'))
            ->get("/projects/{$project->id}/payments")
            ->assertForbidden();

        $this->actingAs($this->makeUser('hr'))
            ->get('/payroll/run')
            ->assertOk();

        $this->actingAs($this->makeUser('hr'))
            ->get("/projects/{$project->id}/payments")
            ->assertOk();

        $this->actingAs($this->makeUser('hr'))
            ->patch("/projects/{$project->id}/financials", [])
            ->assertStatus(302);
    }

    private function makeUser(string $role): User
    {
        return User::create([
            'fullname' => ucfirst($role) . ' User',
            'email' => $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }

    private function makeProject(): Project
    {
        return Project::create([
            'name' => 'Visibility Project',
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
