<?php

namespace Tests\Feature;

use App\Models\BuildProject;
use App\Models\Expense;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ExpenseTrackerTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_get_project_expenses_summary(): void
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

        $this->actingAs($this->makeUser('admin'))
            ->getJson('/projects/9/expenses')
            ->assertOk()
            ->assertJsonPath('total_expenses', 150000)
            ->assertJsonPath('remaining_income', 350000);
    }

    public function test_admin_can_create_update_and_delete_expense(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)
            ->post('/projects/10/expenses', [
                'category' => 'equipment',
                'amount' => 20000,
                'note' => 'Rental',
                'date' => '2026-02-21',
            ])
            ->assertRedirect('/projects/10/build?tab=expenses');

        $expense = Expense::where('project_id', 10)->firstOrFail();

        $this->actingAs($admin)
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

        $this->actingAs($admin)
            ->delete('/expenses/' . $expense->id)
            ->assertRedirect('/projects/10/build?tab=expenses');

        $this->assertDatabaseMissing('expenses', ['id' => $expense->id]);
    }

    public function test_hr_and_foreman_cannot_manage_expenses(): void
    {
        $expense = Expense::create([
            'project_id' => 22,
            'category' => 'materials',
            'amount' => 1000,
            'note' => null,
            'date' => '2026-02-21',
        ]);

        $this->actingAs($this->makeUser('hr'))
            ->get('/projects/22/expenses')
            ->assertForbidden();

        $this->actingAs($this->makeUser('foreman'))
            ->post('/projects/22/expenses', [
                'category' => 'materials',
                'amount' => 2000,
                'note' => null,
                'date' => '2026-02-21',
            ])
            ->assertForbidden();

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
