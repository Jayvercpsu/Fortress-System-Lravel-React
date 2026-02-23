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

    public function test_head_admin_and_hr_can_open_payments_page_but_admin_cannot(): void
    {
        $project = $this->makeProject(1000);

        $this->actingAs($this->makeUser('head_admin'))
            ->get("/projects/{$project->id}/payments")
            ->assertOk();

        $this->actingAs($this->makeUser('hr'))
            ->get("/projects/{$project->id}/payments")
            ->assertOk();

        $this->actingAs($this->makeUser('admin'))
            ->get("/projects/{$project->id}/payments")
            ->assertForbidden();
    }

    public function test_insert_and_delete_payments_instantly_update_project_financial_overview(): void
    {
        $project = $this->makeProject(1000);
        $headAdmin = $this->makeUser('head_admin');
        $hr = $this->makeUser('hr');

        $this->actingAs($headAdmin)
            ->post("/projects/{$project->id}/payments", [
                'amount' => 300,
                'date_paid' => '2026-02-22',
                'reference' => 'RCPT-001',
                'note' => 'First tranche',
            ])
            ->assertRedirect("/projects/{$project->id}/payments");

        $project->refresh();
        $this->assertSame('300.00', (string) $project->total_client_payment);
        $this->assertSame('700.00', (string) $project->remaining_balance);
        $this->assertSame('2026-02-22', optional($project->last_paid_date)->toDateString());

        $this->actingAs($hr)
            ->post("/projects/{$project->id}/payments", [
                'amount' => 200,
                'date_paid' => '2026-02-23',
                'reference' => 'RCPT-002',
                'note' => 'Second tranche',
            ])
            ->assertRedirect("/projects/{$project->id}/payments");

        $project->refresh();
        $this->assertSame('500.00', (string) $project->total_client_payment);
        $this->assertSame('500.00', (string) $project->remaining_balance);
        $this->assertSame('2026-02-23', optional($project->last_paid_date)->toDateString());

        $latestPayment = Payment::where('project_id', $project->id)
            ->where('reference', 'RCPT-002')
            ->firstOrFail();

        $this->actingAs($hr)
            ->delete("/payments/{$latestPayment->id}")
            ->assertRedirect("/projects/{$project->id}/payments");

        $project->refresh();
        $this->assertSame('300.00', (string) $project->total_client_payment);
        $this->assertSame('700.00', (string) $project->remaining_balance);
        $this->assertSame('2026-02-22', optional($project->last_paid_date)->toDateString());

        $remainingPayment = Payment::where('project_id', $project->id)->firstOrFail();
        $this->actingAs($headAdmin)
            ->delete("/payments/{$remainingPayment->id}")
            ->assertRedirect("/projects/{$project->id}/payments");

        $project->refresh();
        $this->assertSame('0.00', (string) $project->total_client_payment);
        $this->assertSame('1000.00', (string) $project->remaining_balance);
        $this->assertNull($project->last_paid_date);
    }

    private function makeProject(float $contractAmount): Project
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
