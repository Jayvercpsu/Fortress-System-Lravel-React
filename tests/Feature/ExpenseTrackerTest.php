<?php

namespace Tests\Feature;

use App\Models\BuildProject;
use App\Models\Expense;
use App\Models\Project;
use App\Models\User;
use App\Repositories\Contracts\BuildRepositoryInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ExpenseTrackerTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_can_get_project_expenses_summary(): void
    {
        BuildProject::create([
            'project_id' => 9,
            'construction_contract' => 500000,
            'total_client_payment' => 0,
            'materials_cost' => 0,
            'labor_cost' => 0,
            'equipment_cost' => 0,
        ]);

        Expense::create([
            'project_id' => 9,
            'category' => 'materials',
            'amount' => 100000,
            'note' => 'Cement',
            'date' => '2026-02-21',
        ]);

        Expense::create([
            'project_id' => 9,
            'category' => 'labor',
            'amount' => 50000,
            'note' => 'Crew',
            'date' => '2026-02-21',
        ]);

        $this->actingAs($this->makeUser('head_admin'))
            ->getJson('/projects/9/expenses')
            ->assertOk()
            ->assertJsonPath('total_expenses', 150000)
            ->assertJsonPath('remaining_income', 350000);
    }

    public function test_head_admin_can_create_update_and_delete_expense(): void
    {
        $headAdmin = $this->makeUser('head_admin');

        $this->actingAs($headAdmin)
            ->post('/projects/10/expenses', [
                'category' => 'equipment',
                'amount' => 20000,
                'note' => 'Rental',
                'date' => '2026-02-21',
            ])
            ->assertRedirect('/projects/10/build?tab=expenses');

        $expense = Expense::where('project_id', 10)->firstOrFail();

        $this->actingAs($headAdmin)
            ->patch('/expenses/' . $expense->id, [
                'category' => 'equipment',
                'amount' => 25000,
                'note' => 'Updated rental',
                'date' => '2026-02-22',
            ])
            ->assertRedirect('/projects/10/build?tab=expenses');

        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'amount' => 25000,
            'note' => 'Updated rental',
        ]);

        $this->actingAs($headAdmin)
            ->delete('/expenses/' . $expense->id)
            ->assertRedirect('/projects/10/build?tab=expenses');

        $this->assertSoftDeleted('expenses', ['id' => $expense->id]);
    }

    public function test_expenses_table_lists_latest_created_first(): void
    {
        $olderDate = Expense::create([
            'project_id' => 31,
            'category' => 'Materials',
            'amount' => 100,
            'note' => 'Older receipt date, created first',
            'date' => '2026-09-04',
        ]);

        $newerCreated = Expense::create([
            'project_id' => 31,
            'category' => 'Labor',
            'amount' => 200,
            'note' => 'Newer creation, older receipt date',
            'date' => '2026-08-01',
        ]);

        $page = app(BuildRepositoryInterface::class)->paginatedExpenses('31', '', 50);

        $this->assertEquals(
            [$newerCreated->id, $olderDate->id],
            $page->pluck('id')->all()
        );
    }

    public function test_paginated_expenses_include_created_at(): void
    {
        $expense = Expense::create([
            'project_id' => 32,
            'category' => 'Materials',
            'amount' => 150,
            'note' => 'Created-at payload check',
            'date' => '2026-09-04',
        ]);

        $page = app(BuildRepositoryInterface::class)->paginatedExpenses('32', '', 50);

        $row = collect($page->items())->firstWhere('id', $expense->id);

        $this->assertNotNull($row);
        $this->assertNotNull($row->created_at);
    }

    public function test_expenses_table_defaults_to_ten_per_page(): void
    {
        $project = Project::create([
            'name' => 'Per Page Building',
            'client' => 'ABC Corp',
            'type' => 'Commercial',
            'location' => 'Cebu City',
            'phase' => 'Construction',
            'status' => 'active',
        ]);

        $this->actingAs($this->makeUser('head_admin'))
            ->get("/projects/{$project->id}/build")
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('HeadAdmin/Build/Show')
                ->where('expenseTable.per_page', 10));
    }

    public function test_admin_can_manage_expenses_but_hr_and_foreman_cannot(): void
    {
        $expense = Expense::create([
            'project_id' => 22,
            'category' => 'materials',
            'amount' => 1000,
            'note' => null,
            'date' => '2026-02-21',
        ]);

        $this->actingAs($this->makeUser('admin'))
            ->get('/projects/22/expenses')
            ->assertRedirect('/projects/22/build?tab=expenses');

        $this->actingAs($this->makeUser('hr'))
            ->get('/projects/22/expenses')
            ->assertForbidden();

        $this->actingAs($this->makeUser('admin'))
            ->post('/projects/22/expenses', [
                'category' => 'materials',
                'amount' => 2000,
                'note' => null,
                'date' => '2026-02-21',
            ])
            ->assertRedirect('/projects/22/build?tab=expenses');

        $this->actingAs($this->makeUser('foreman'))
            ->post('/projects/22/expenses', [
                'category' => 'materials',
                'amount' => 2000,
                'note' => null,
                'date' => '2026-02-21',
            ])
            ->assertForbidden();

        $this->actingAs($this->makeUser('admin'))
            ->patch('/expenses/' . $expense->id, [
                'category' => 'materials',
                'amount' => 3000,
                'note' => null,
                'date' => '2026-02-21',
            ])
            ->assertRedirect('/projects/22/build?tab=expenses');

        $this->actingAs($this->makeUser('hr'))
            ->patch('/expenses/' . $expense->id, [
                'category' => 'materials',
                'amount' => 3000,
                'note' => null,
                'date' => '2026-02-21',
            ])
            ->assertForbidden();

        $this->actingAs($this->makeUser('foreman'))
            ->delete('/expenses/' . $expense->id)
            ->assertForbidden();

        $this->actingAs($this->makeUser('admin'))
            ->delete('/expenses/' . $expense->id)
            ->assertRedirect('/projects/22/build?tab=expenses');
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
