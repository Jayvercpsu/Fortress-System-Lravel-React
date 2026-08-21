<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProjectPaymentsTest extends TestCase
{
    use RefreshDatabase;

    public function test_head_admin_admin_and_hr_can_open_payments_page(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $project = $this->makeProject(1000, $headAdmin->id);

        $this->actingAs($headAdmin)
            ->get("/projects/{$project->id}/payments")
            ->assertOk();

        $this->actingAs($this->makeUser('hr'))
            ->get("/projects/{$project->id}/payments")
            ->assertOk();

        $this->actingAs($this->makeUser('admin'))
            ->get("/projects/{$project->id}/payments")
            ->assertOk();
    }

    public function test_insert_and_delete_payments_update_the_derived_financial_overview(): void
    {
        $headAdmin = $this->makeUser('head_admin');
        $project = $this->makeProject(1000, $headAdmin->id);
        $hr = $this->makeUser('hr');

        $this->actingAs($headAdmin)
            ->post("/projects/{$project->id}/payments", [
                'amount' => 300,
                'date_paid' => '2026-02-22',
                'reference' => 'RCPT-001',
                'note' => 'First tranche',
            ])
            ->assertRedirect("/projects/{$project->id}/payments");

        $this->assertDatabaseHas('payments', [
            'project_id' => $project->id,
            'amount' => 300,
            'reference' => 'RCPT-001',
        ]);

        // The financial overview is derived from the payments table.
        $this->assertSame(300, (int) $project->payments()->sum('amount'));
        $this->assertSame('2026-02-22', optional($project->refresh()->last_paid_date)->toDateString());

        $this->actingAs($hr)
            ->post("/projects/{$project->id}/payments", [
                'amount' => 200,
                'date_paid' => '2026-02-23',
                'reference' => 'RCPT-002',
                'note' => 'Second tranche',
            ])
            ->assertRedirect("/projects/{$project->id}/payments");

        $this->assertSame(500, (int) $project->refresh()->payments()->sum('amount'));
        $this->assertSame('2026-02-23', optional($project->refresh()->last_paid_date)->toDateString());

        $latestPayment = Payment::where('project_id', $project->id)
            ->where('reference', 'RCPT-002')
            ->firstOrFail();

        $this->actingAs($hr)
            ->delete("/payments/{$latestPayment->id}")
            ->assertRedirect("/projects/{$project->id}/payments");

        $this->assertSoftDeleted('payments', ['id' => $latestPayment->id]);
        $this->assertSame(300, (int) $project->refresh()->payments()->sum('amount'));
        $this->assertSame('2026-02-22', optional($project->refresh()->last_paid_date)->toDateString());

        $remainingPayment = Payment::where('project_id', $project->id)->firstOrFail();
        $this->actingAs($headAdmin)
            ->delete("/payments/{$remainingPayment->id}")
            ->assertRedirect("/projects/{$project->id}/payments");

        $this->assertSoftDeleted('payments', ['id' => $remainingPayment->id]);
        $this->assertSame(0, (int) $project->refresh()->payments()->sum('amount'));
        $this->assertNull($project->refresh()->last_paid_date);
    }

    private function makeProject(float $contractAmount, ?int $userId = null): Project
    {
        return Project::create([
            'name' => 'Payments Project',
            'client' => 'Client P',
            'type' => 'Commercial',
            'location' => 'QC',
            'assigned' => null,
            'target' => null,
            'status' => 'PLANNING',
            'phase' => 'DESIGN',
            'overall_progress' => 0,
            'contract_amount' => $contractAmount,
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
