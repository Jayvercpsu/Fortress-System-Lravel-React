<?php

namespace Tests\Feature;

use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProjectScopedListPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_regular_head_admin_does_not_see_other_head_admins_rows_on_grouped_pages(): void
    {
        [$viewer, $owner, $legacyProject, $ownerProject] = $this->seedRows();

        $this->actingAs($viewer)
            ->get('/materials')
            ->assertOk()
            ->assertDontSee('Owner Rebar')
            ->assertDontSee('Legacy Cement');

        $this->actingAs($viewer)
            ->get('/delivery')
            ->assertOk()
            ->assertDontSee('Owner PVC')
            ->assertDontSee('Legacy Steel');

        $this->actingAs($viewer)
            ->get('/issues')
            ->assertOk()
            ->assertDontSee('Owner Roof Issue')
            ->assertDontSee('Legacy Drainage Issue');

        $this->actingAs($viewer)
            ->get('/progress-photos')
            ->assertOk()
            ->assertDontSee('Owner Progress Shot')
            ->assertDontSee('Legacy Progress Shot');

        $this->actingAs($viewer)
            ->get('/reports')
            ->assertOk()
            ->assertDontSee($ownerProject->name)
            ->assertDontSee($legacyProject->name);
    }

    public function test_special_head_admin_sees_legacy_project_rows_on_grouped_pages(): void
    {
        [$viewer, $special, $legacyProject, $ownerProject] = $this->seedRows();

        $this->actingAs($special)
            ->get('/materials')
            ->assertOk()
            ->assertSee('Legacy Cement')
            ->assertDontSee('Owner Rebar');

        $this->actingAs($special)
            ->get('/delivery')
            ->assertOk()
            ->assertSee('Legacy Steel')
            ->assertDontSee('Owner PVC');

        $this->actingAs($special)
            ->get('/issues')
            ->assertOk()
            ->assertSee('Legacy Drainage Issue')
            ->assertDontSee('Owner Roof Issue');

        $this->actingAs($special)
            ->get('/progress-photos')
            ->assertOk()
            ->assertSee('Legacy Progress Shot')
            ->assertDontSee('Owner Progress Shot');

        $this->actingAs($special)
            ->get('/reports')
            ->assertOk()
            ->assertSee($legacyProject->name)
            ->assertDontSee($ownerProject->name);
    }

    public function test_admin_still_sees_all_projects_on_grouped_pages(): void
    {
        [, , $legacyProject, $ownerProject] = $this->seedRows();
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)
            ->get('/materials')
            ->assertOk()
            ->assertSee('Owner Rebar')
            ->assertSee('Legacy Cement');

        $this->actingAs($admin)
            ->get('/delivery')
            ->assertOk()
            ->assertSee('Owner PVC')
            ->assertSee('Legacy Steel');

        $this->actingAs($admin)
            ->get('/issues')
            ->assertOk()
            ->assertSee('Owner Roof Issue')
            ->assertSee('Legacy Drainage Issue');

        $this->actingAs($admin)
            ->get('/progress-photos')
            ->assertOk()
            ->assertSee('Owner Progress Shot')
            ->assertSee('Legacy Progress Shot');

        $this->actingAs($admin)
            ->get('/reports')
            ->assertForbidden();
    }

    private function seedRows(): array
    {
        $viewer = $this->makeUser('head_admin');
        $owner = $this->makeUser('head_admin');
        $special = User::create([
            'fullname' => 'Head Admin',
            'email' => User::LEGACY_PROJECT_ACCESS_EMAIL,
            'password' => Hash::make('password'),
            'role' => 'head_admin',
        ]);
        $foreman = $this->makeUser('foreman');

        $legacyProject = $this->makeProject('Legacy Shared Project');
        $ownerProject = $this->makeProject('Owner Secret Project', $owner->id);

        MaterialRequest::create([
            'project_id' => $legacyProject->id,
            'foreman_id' => $foreman->id,
            'material_name' => 'Legacy Cement',
            'quantity' => 10,
            'unit' => 'bags',
            'status' => 'pending',
        ]);
        MaterialRequest::create([
            'project_id' => $ownerProject->id,
            'foreman_id' => $foreman->id,
            'material_name' => 'Owner Rebar',
            'quantity' => 5,
            'unit' => 'pc',
            'status' => 'pending',
        ]);

        DeliveryConfirmation::create([
            'project_id' => $legacyProject->id,
            'foreman_id' => $foreman->id,
            'item_delivered' => 'Legacy Steel',
            'quantity' => 3,
            'delivery_date' => '2026-08-10',
            'supplier' => 'Supplier A',
            'status' => 'received',
        ]);
        DeliveryConfirmation::create([
            'project_id' => $ownerProject->id,
            'foreman_id' => $foreman->id,
            'item_delivered' => 'Owner PVC',
            'quantity' => 2,
            'delivery_date' => '2026-08-11',
            'supplier' => 'Supplier B',
            'status' => 'received',
        ]);

        IssueReport::create([
            'project_id' => $legacyProject->id,
            'foreman_id' => $foreman->id,
            'issue_title' => 'Legacy Drainage Issue',
            'description' => 'Clogged drainage.',
            'severity' => 'low',
            'status' => 'open',
        ]);
        IssueReport::create([
            'project_id' => $ownerProject->id,
            'foreman_id' => $foreman->id,
            'issue_title' => 'Owner Roof Issue',
            'description' => 'Roof leak.',
            'severity' => 'high',
            'status' => 'open',
        ]);

        ProgressPhoto::create([
            'project_id' => $legacyProject->id,
            'foreman_id' => $foreman->id,
            'photo_path' => 'progress-photos/legacy.jpg',
            'caption' => 'Legacy Progress Shot',
        ]);
        ProgressPhoto::create([
            'project_id' => $ownerProject->id,
            'foreman_id' => $foreman->id,
            'photo_path' => 'progress-photos/owner.jpg',
            'caption' => 'Owner Progress Shot',
        ]);

        return [$viewer, $special, $legacyProject, $ownerProject];
    }

    private function makeProject(string $name, ?int $userId = null): Project
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
            'fullname' => ucfirst($role) . ' User',
            'email' => $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
        ]);
    }
}