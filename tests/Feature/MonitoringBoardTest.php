<?php

namespace Tests\Feature;

use App\Models\MonitoringBoardDepartment;
use App\Models\MonitoringBoardItem;
use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MonitoringBoardTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_can_manage_scopes_and_overall_progress_recomputes(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $project = $this->makeProject($headAdmin->id);
        $foremanA = $this->makeUser('foreman');
        $foremanB = $this->makeUser('foreman');

        $this->actingAs($headAdmin)
            ->post("/projects/{$project->id}/scopes", [
                'scope_name' => 'Foundation',
                'assigned_personnel' => $foremanA->fullname,
                'progress_percent' => 20,
                'status' => 'IN_PROGRESS',
                'remarks' => 'Started excavation.',
                'contract_amount' => 100000,
                'weight_percent' => 20,
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(20, (int) $project->overall_progress);

        $firstScope = ProjectScope::where('project_id', $project->id)->firstOrFail();

        $this->actingAs($headAdmin)
            ->patch("/scopes/{$firstScope->id}", [
                'scope_name' => 'Foundation',
                'assigned_personnel' => $foremanA->fullname,
                'progress_percent' => 80,
                'status' => 'IN_PROGRESS',
                'remarks' => 'Nearly done.',
                'contract_amount' => 100000,
                'weight_percent' => 20,
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(80, (int) $project->overall_progress);

        $this->actingAs($headAdmin)
            ->post("/projects/{$project->id}/scopes", [
                'scope_name' => 'Roofing',
                'assigned_personnel' => $foremanB->fullname,
                'progress_percent' => 20,
                'status' => 'NOT_STARTED',
                'remarks' => null,
                'contract_amount' => 80000,
                'weight_percent' => 15,
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(50, (int) $project->overall_progress);

        $secondScope = ProjectScope::where('project_id', $project->id)
            ->where('scope_name', 'Roofing')
            ->firstOrFail();

        $this->actingAs($headAdmin)
            ->delete("/scopes/{$secondScope->id}")
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(80, (int) $project->overall_progress);
    }

    public function test_admin_can_view_monitoring_board_but_hr_cannot_access_it(): void
    {
        $project = $this->makeProject();

        $this->actingAs($this->makeUser('admin'))
            ->get("/projects/{$project->id}/monitoring")
            ->assertOk();

        $this->actingAs($this->makeUser('hr'))
            ->get("/projects/{$project->id}/monitoring")
            ->assertForbidden();
    }

    public function test_design_url_serves_monitoring_board_index_for_authorized_roles(): void
    {
        $allowedRoles = ['head_admin', 'admin', 'designer'];

        foreach ($allowedRoles as $role) {
            $this->actingAs($this->makeUser($role))
                ->get('/design')
                ->assertOk();
        }
    }

    public function test_design_url_is_forbidden_for_disallowed_roles(): void
    {
        $this->actingAs($this->makeUser('hr'))
            ->get('/design')
            ->assertForbidden();
    }

    public function test_design_index_loads_when_departments_and_items_share_names(): void
    {
        // Reproduces a crash where diffing Eloquent string collections called
        // getKey() on plain strings when the departments table was not empty.
        MonitoringBoardDepartment::query()->create(['name' => 'Autocad']);

        $headAdmin = $this->makeUser('head_admin');
        $this->makeBoardItem('Fortress One', $headAdmin->id);

        $this->actingAs($headAdmin)
            ->get('/design')
            ->assertOk()
            ->assertSee('Fortress One');
    }

    public function test_master_admin_sees_every_design_item(): void
    {
        $master = $this->makeUser('master_admin');
        $special = $this->makeUser('head_admin', User::LEGACY_PROJECT_ACCESS_EMAIL);
        $second = $this->makeUser('head_admin');
        $designer = $this->makeUser('designer');

        $this->makeBoardItem('Legacy Alpha', $special->id);
        $this->makeBoardItem('Master Owned', $master->id);
        $this->makeBoardItem('Second Owned', $second->id);
        $this->makeBoardItem('Designer Owned', $designer->id);

        $this->actingAs($master)
            ->get('/design')
            ->assertOk()
            ->assertSee('Legacy Alpha')
            ->assertSee('Master Owned')
            ->assertSee('Second Owned')
            ->assertSee('Designer Owned');
    }

    public function test_regular_head_admin_sees_only_their_own_design_items(): void
    {
        $master = $this->makeUser('master_admin');
        $special = $this->makeUser('head_admin', User::LEGACY_PROJECT_ACCESS_EMAIL);
        $second = $this->makeUser('head_admin');

        $this->makeBoardItem('Legacy Alpha', $special->id);
        $this->makeBoardItem('Master Owned', $master->id);
        $this->makeBoardItem('Second Owned', $second->id);

        $this->actingAs($second)
            ->get('/design')
            ->assertOk()
            ->assertSee('Second Owned')
            ->assertDontSee('Legacy Alpha')
            ->assertDontSee('Master Owned');
    }

    public function test_legacy_account_sees_own_and_master_admin_created_design_items(): void
    {
        $master = $this->makeUser('master_admin');
        $special = $this->makeUser('head_admin', User::LEGACY_PROJECT_ACCESS_EMAIL);
        $second = $this->makeUser('head_admin');

        $this->makeBoardItem('Legacy Alpha', $special->id);
        $this->makeBoardItem('Master Owned', $master->id);
        $this->makeBoardItem('Second Owned', $second->id);

        $this->actingAs($special)
            ->get('/design')
            ->assertOk()
            ->assertSee('Legacy Alpha')
            ->assertSee('Master Owned')
            ->assertDontSee('Second Owned');
    }

    public function test_designer_sees_only_their_own_design_items(): void
    {
        $master = $this->makeUser('master_admin');
        $second = $this->makeUser('head_admin');
        $designer = $this->makeUser('designer');

        $this->makeBoardItem('Master Owned', $master->id);
        $this->makeBoardItem('Designer One', $designer->id);
        $this->makeBoardItem('Second Owned', $second->id);

        $this->actingAs($designer)
            ->get('/design')
            ->assertOk()
            ->assertSee('Designer One')
            ->assertDontSee('Master Owned')
            ->assertDontSee('Second Owned');
    }

    public function test_regular_head_admin_cannot_update_or_delete_another_users_design_item(): void
    {
        $second = $this->makeUser('head_admin');
        $otherItem = $this->makeBoardItem('Second Owned', $second->id);
        $masterItem = $this->makeBoardItem('Master Owned', $second->id);

        $other = $this->makeUser('head_admin');

        $this->actingAs($other)
            ->patch("/design/{$masterItem->id}", [
                'department' => 'Autocad',
                'client_name' => 'Client',
                'project_name' => 'Hijacked',
                'project_type' => 'Commercial',
                'location' => 'QC',
                'status' => 'PROPOSAL',
                'progress_percent' => 10,
            ])
            ->assertForbidden();

        $this->actingAs($other)
            ->delete("/design/{$masterItem->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('monitoring_board_items', ['id' => $masterItem->id]);
        $this->assertDatabaseHas('monitoring_board_items', ['id' => $otherItem->id]);
    }

    public function test_scope_recompute_to_100_auto_closes_project_and_notifies_hr_and_head_admin(): void
    {
        config()->set('fortress.auto_complete_project_on_progress', true);

        $headAdmin = $this->makeUser('head_admin');
        $project = $this->makeProject($headAdmin->id);
        $hr = $this->makeUser('hr');
        $foreman = $this->makeUser('foreman');

        $this->actingAs($headAdmin)
            ->post("/projects/{$project->id}/scopes", [
                'scope_name' => 'Final Turnover',
                'assigned_personnel' => $foreman->fullname,
                'progress_percent' => 100,
                'status' => 'COMPLETED',
                'remarks' => 'All scope items done.',
                'contract_amount' => 50000,
                'weight_percent' => 100,
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $project->refresh();
        $this->assertSame(100, (int) $project->overall_progress);
        $this->assertSame('COMPLETED', $project->status);

        $this->assertGreaterThan(0, $headAdmin->notifications()->count());
        $this->assertGreaterThan(0, $hr->notifications()->count());
    }

    public function test_head_admin_can_upload_scope_photo_with_caption(): void
    {
        Storage::fake('public');

        $project = $this->makeProject();
        $scope = ProjectScope::create([
            'project_id' => $project->id,
            'scope_name' => 'Formworks',
            'assigned_personnel' => 'Crew C',
            'progress_percent' => 25,
            'status' => 'IN_PROGRESS',
            'remarks' => null,
            'contract_amount' => 10000,
            'weight_percent' => 25,
        ]);

        $headAdmin = $this->makeUser('head_admin');
        $photo = UploadedFile::fake()->create('site-photo.jpg', 10, 'image/jpeg');

        $this->actingAs($headAdmin)
            ->post("/scopes/{$scope->id}/photos", [
                'photo' => $photo,
                'caption' => 'Day 1 setup',
            ])
            ->assertRedirect("/projects/{$project->id}/monitoring");

        $this->assertDatabaseHas('scope_photos', [
            'project_scope_id' => $scope->id,
            'caption' => 'Day 1 setup',
        ]);

        $storedPath = (string) \DB::table('scope_photos')
            ->where('project_scope_id', $scope->id)
            ->value('photo_path');

        Storage::disk('public')->assertExists($storedPath);
    }

    public function test_regular_head_admin_sees_only_their_own_departments(): void
    {
        $owner = $this->makeUser('head_admin');
        $other = $this->makeUser('head_admin');
        $master = $this->makeUser('master_admin');

        $this->makeDepartment('OwnerDept', $owner->id);
        $this->makeDepartment('OtherDept', $other->id);
        $this->makeDepartment('MasterDept', $master->id);

        $this->actingAs($owner)
            ->get('/design')
            ->assertOk()
            ->assertSee('OwnerDept')
            ->assertDontSee('OtherDept')
            ->assertDontSee('MasterDept');
    }

    public function test_master_admin_sees_all_departments(): void
    {
        $master = $this->makeUser('master_admin');
        $headAdmin = $this->makeUser('head_admin');
        $designer = $this->makeUser('designer');

        $this->makeDepartment('HeadDept', $headAdmin->id);
        $this->makeDepartment('DesignerDept', $designer->id);
        $this->makeDepartment('MasterDept', $master->id);

        $this->actingAs($master)
            ->get('/design')
            ->assertOk()
            ->assertSee('HeadDept')
            ->assertSee('DesignerDept')
            ->assertSee('MasterDept');
    }

    public function test_legacy_account_sees_own_and_master_admin_departments_only(): void
    {
        $master = $this->makeUser('master_admin');
        $legacy = $this->makeUser('head_admin', User::LEGACY_PROJECT_ACCESS_EMAIL);
        $designer = $this->makeUser('designer');
        $otherHeadAdmin = $this->makeUser('head_admin');

        $this->makeDepartment('LegacyDept', $legacy->id);
        $this->makeDepartment('MasterDept', $master->id);
        $this->makeDepartment('DesignerDept', $designer->id);
        $this->makeDepartment('OtherHeadDept', $otherHeadAdmin->id);

        $this->actingAs($legacy)
            ->get('/design')
            ->assertOk()
            ->assertSee('LegacyDept')
            ->assertSee('MasterDept')
            ->assertDontSee('DesignerDept')
            ->assertDontSee('OtherHeadDept');
    }

    public function test_designer_sees_only_their_own_departments(): void
    {
        $designer = $this->makeUser('designer');
        $headAdmin = $this->makeUser('head_admin');

        $this->makeDepartment('DesignerDept', $designer->id);
        $this->makeDepartment('HeadDept', $headAdmin->id);

        $this->actingAs($designer)
            ->get('/design')
            ->assertOk()
            ->assertSee('DesignerDept')
            ->assertDontSee('HeadDept');
    }

    public function test_rows_without_creator_are_visible_to_master_admin_only(): void
    {
        $master = $this->makeUser('master_admin');
        $legacy = $this->makeUser('head_admin', User::LEGACY_PROJECT_ACCESS_EMAIL);
        $headAdmin = $this->makeUser('head_admin');
        $designer = $this->makeUser('designer');

        $this->makeDepartment('OrphanDept', null);
        MonitoringBoardItem::query()->create([
            'department' => 'OrphanDept',
            'client_name' => 'Client',
            'project_name' => 'Orphan Project',
            'project_type' => 'Commercial',
            'location' => 'City',
            'status' => 'PROPOSAL',
            'created_by' => null,
        ]);

        $this->actingAs($master)
            ->get('/design')
            ->assertOk()
            ->assertSee('OrphanDept')
            ->assertSee('Orphan Project');

        foreach ([$legacy, $headAdmin, $designer] as $user) {
            $this->actingAs($user)
                ->get('/design')
                ->assertOk()
                ->assertDontSee('OrphanDept')
                ->assertDontSee('Orphan Project');
        }
    }

    public function test_deleting_own_department_removes_own_items_and_soft_deletes_it(): void
    {
        $designer = $this->makeUser('designer');
        $departmentName = 'SoloDeptTest';

        $department = $this->makeDepartment($departmentName, $designer->id);
        $item = $this->makeBoardItem('Project Solo', $designer->id);
        MonitoringBoardItem::query()->whereKey($item->id)->update(['department' => $departmentName]);

        $this->actingAs($designer)
            ->delete("/design/departments/{$department->id}")
            ->assertRedirect('/design');

        $this->assertDatabaseMissing('monitoring_board_items', ['id' => $item->id]);
        $this->assertNotNull(
            MonitoringBoardDepartment::withTrashed()->where('name', $departmentName)->value('deleted_at')
        );
    }

    public function test_cannot_delete_another_users_department(): void
    {
        $owner = $this->makeUser('head_admin');
        $other = $this->makeUser('head_admin');
        $department = $this->makeDepartment('OwnerOnlyDept', $owner->id);

        $this->actingAs($other)
            ->delete("/design/departments/{$department->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('monitoring_board_departments', [
            'id' => $department->id,
            'deleted_at' => null,
        ]);
    }

    public function test_deleting_department_with_completed_name_is_forbidden(): void
    {
        $designer = $this->makeUser('designer');
        $department = $this->makeDepartment('Completed', $designer->id);

        $this->actingAs($designer)
            ->delete("/design/departments/{$department->id}")
            ->assertStatus(422);

        $this->assertDatabaseHas('monitoring_board_departments', ['name' => 'Completed']);
    }

    public function test_head_admin_dashboard_total_users_matches_users_page_count(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        // Create regular users created_by the head_admin so they appear in the filtered list
        $foreman = $this->makeUser('foreman', createdBy: $headAdmin->id);
        $hr = $this->makeUser('hr', createdBy: $headAdmin->id);
        $admin = $this->makeUser('admin', createdBy: $headAdmin->id);

        // /head-admin dashboard total_users should match /users page total
        $this->actingAs($headAdmin)
            ->get('/head-admin')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('kpis.users.total_users', 3)
            );

        $this->actingAs($headAdmin)
            ->get('/users')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('userTable.total', 3)
            );
    }

    private function makeProject(?int $userId = null): Project
    {
        return Project::create([
            'name' => 'Monitoring Project',
            'client' => 'Client X',
            'type' => 'Residential',
            'location' => 'QC',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
            'user_id' => $userId,
        ]);
    }

    private function makeUser(string $role, ?string $email = null, ?int $createdBy = null): User
    {
        return User::create([
            'fullname' => ucfirst($role) . ' User',
            'email' => $email ?? $role . '_' . uniqid() . '@example.test',
            'password' => Hash::make('password'),
            'role' => $role,
            'created_by' => $createdBy,
        ]);
    }

    private function makeDepartment(string $name, ?int $createdBy = null): MonitoringBoardDepartment
    {
        return MonitoringBoardDepartment::query()->create([
            'name' => $name,
            'created_by' => $createdBy,
        ]);
    }

    private function makeBoardItem(string $projectName, int $createdBy): MonitoringBoardItem
    {
        return MonitoringBoardItem::create([
            'department' => 'Autocad',
            'client_name' => 'Client',
            'project_name' => $projectName,
            'project_type' => 'Commercial',
            'location' => 'City',
            'status' => 'PROPOSAL',
            'created_by' => $createdBy,
        ]);
    }
}
