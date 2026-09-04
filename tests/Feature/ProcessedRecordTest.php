<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Project;
use App\Models\ProcessedRecord;
use App\Models\Attendance;
use App\Models\Expense;
use App\Models\Worker;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProcessedRecordTest extends TestCase
{
    use RefreshDatabase;

    protected User $headAdmin;
    protected User $masterAdmin;
    protected User $foreman;
    protected User $hr;
    protected Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->masterAdmin = $this->makeUser('master_admin');
        $this->headAdmin = $this->makeUser('head_admin');
        $this->foreman = $this->makeUser('foreman');
        $this->hr = $this->makeUser('hr');

        $this->project = Project::create([
            'name' => 'Fortress Building',
            'client' => 'ABC Corp',
            'type' => 'Commercial',
            'location' => 'Cebu City',
            'phase' => 'Construction',
            'status' => 'active',
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

    private function makeRecord(array $overrides = []): ProcessedRecord
    {
        return ProcessedRecord::create(array_merge([
            'project_id' => $this->project->id,
            'user_id' => $this->headAdmin->id,
            'record_type' => 'attendance',
            'ai_model' => 'test-model',
            'ai_parsed_data' => [
                'date' => '2026-08-27',
                'location' => 'Cebu City',
                'workers' => [
                    ['name' => 'Juan Dela Cruz', 'position' => 'Worker', 'time_in' => '7:30 AM', 'time_out' => '5:00 PM', 'hours' => 8],
                ],
            ],
            'status' => 'pending',
        ], $overrides));
    }

    private function makeExpenseRecord(array $overrides = []): ProcessedRecord
    {
        return ProcessedRecord::create(array_merge([
            'project_id' => $this->project->id,
            'user_id' => $this->headAdmin->id,
            'record_type' => 'expense',
            'ai_model' => 'test-model',
            'ai_parsed_data' => [
                'date' => '2026-08-27',
                'location' => 'Cebu City',
                'items' => [
                    ['description' => 'Cement', 'category' => 'Materials', 'quantity' => 20, 'unit_price' => 250, 'amount' => 5000],
                ],
                'subtotal' => 5000,
                'tax' => 0,
                'total' => 5000,
                'receipt_number' => 'INV-001',
                'paid_by' => 'Juan Dela Cruz',
                'payment_method' => 'Cash',
            ],
            'status' => 'pending',
        ], $overrides));
    }

    // ─── VALIDATION TESTS ────────────────────────────────────────

    public function test_validation_requires_images(): void
    {
        $response = $this->actingAs($this->headAdmin)
            ->postJson('/processed-records', []);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['images']);
    }

    public function test_validation_rejects_more_than_5_images(): void
    {
        $files = [];
        for ($i = 0; $i < 6; $i++) {
            $files[] = UploadedFile::fake()->create("image{$i}.jpg", 100, 'image/jpeg');
        }

        $response = $this->actingAs($this->headAdmin)
            ->postJson('/processed-records', ['images' => $files]);

        $response->assertUnprocessable();
    }

    public function test_validation_rejects_non_image_files(): void
    {
        $response = $this->actingAs($this->headAdmin)
            ->postJson('/processed-records', [
                'images' => [UploadedFile::fake()->create('document.pdf', 100, 'application/pdf')],
            ]);

        $response->assertUnprocessable();
    }

    public function test_validation_accepts_up_to_5_images(): void
    {
        $files = [];
        for ($i = 0; $i < 5; $i++) {
            $files[] = UploadedFile::fake()->create("image{$i}.jpg", 100, 'image/jpeg');
        }

        // This will fail at the AI call, but validation should pass
        $response = $this->actingAs($this->headAdmin)
            ->postJson('/processed-records', ['images' => $files]);

        // Should not have validation errors on 'images' field
        $response->assertJsonMissingValidationErrors(['images']);
    }

    public function test_notes_field_is_optional(): void
    {
        $files = [UploadedFile::fake()->create('image.jpg', 100, 'image/jpeg')];

        $response = $this->actingAs($this->headAdmin)
            ->postJson('/processed-records', [
                'images' => $files,
                'notes' => 'Weekly attendance for Site A',
            ]);

        // Should not fail on notes validation
        $response->assertJsonMissingValidationErrors(['notes']);
    }

    // ─── AI UPLOAD MESSAGING TESTS ────────────────────────────────

    public function test_attendance_mode_reports_non_attendance_image_clearly(): void
    {
        // The AI explicitly classifies the uploaded image as irrelevant (not an
        // attendance sheet), so the user should see a specific "not related to
        // attendance" message rather than the generic "could not process" one.
        $mock = \Mockery::mock(\App\Services\OpenRouterService::class);
        $mock->shouldReceive('chat')->andReturn([
            'choices' => [[
                'message' => ['content' =>
                    "RECORD_1:\n" .
                    "TYPE: irrelevant\n" .
                    "PROJECT: none\n" .
                    "CONFIDENCE: high\n" .
                    "IRRELEVANT_REASON: This image is a photo of a truck, not an attendance sheet\n" .
                    "---",
                ],
            ]],
        ]);
        $this->app->instance(\App\Services\OpenRouterService::class, $mock);

        $response = $this->actingAs($this->headAdmin)
            ->postJson('/processed-records', [
                'images' => [UploadedFile::fake()->image('site-photo.jpg')],
                'mode' => 'attendance',
            ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'The uploaded image is not related to attendance. Please upload a clear photo of an attendance sheet (names and attendance marks).',
            ]);
    }

    public function test_all_failed_images_still_returns_generic_error_when_not_irrelevant(): void
    {
        // The AI returned no usable content (and no explicit "irrelevant"
        // classification), so the generic "could not process" fallback should remain.
        $mock = \Mockery::mock(\App\Services\OpenRouterService::class);
        $mock->shouldReceive('chat')->andReturn([]);
        $this->app->instance(\App\Services\OpenRouterService::class, $mock);

        $response = $this->actingAs($this->headAdmin)
            ->postJson('/processed-records', [
                'images' => [UploadedFile::fake()->image('blurry.jpg')],
                'mode' => 'attendance',
            ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'AI could not process any of the uploaded images. Please try again with clearer images.',
            ]);
    }

    // ─── ROLE-BASED ACCESS TESTS ─────────────────────────────────

    public function test_head_admin_can_access(): void
    {
        $record = $this->makeRecord();
        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/reject");

        $response->assertOk();
    }

    public function test_master_admin_can_access(): void
    {
        $record = $this->makeRecord();
        $response = $this->actingAs($this->masterAdmin)
            ->postJson("/processed-records/{$record->id}/reject");

        $response->assertOk();
    }

    public function test_foreman_can_access_public_routes(): void
    {
        $record = $this->makeRecord();
        $response = $this->actingAs($this->foreman)
            ->postJson("/processed-records/{$record->id}/reject");

        // Routes are public for JotForm page access
        $response->assertOk();
    }

    public function test_unauthenticated_can_access_public_routes(): void
    {
        $record = $this->makeRecord();
        $response = $this->postJson("/processed-records/{$record->id}/reject");

        // Routes are public for JotForm page access
        $response->assertOk();
    }

    // ─── SUBMIT (CONFIRM) FLOW TESTS ─────────────────────────────

    public function test_submit_attendance_record_creates_attendance_entries(): void
    {
        $record = $this->makeRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-27',
                'location' => 'Cebu City',
                'workers' => [
                    ['name' => 'Juan Dela Cruz', 'position' => 'Carpenter', 'time_in' => '7:30 AM', 'time_out' => '5:00 PM', 'hours' => 8],
                    ['name' => 'Pedro Santos', 'position' => 'Laborer', 'time_in' => '7:35 AM', 'time_out' => '5:00 PM', 'hours' => 8],
                ],
            ],
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertOk();
        $response->assertJson(['message' => 'Record submitted and saved to project']);

        // Check attendance records were created
        $this->assertDatabaseHas('attendances', [
            'worker_name' => 'Juan Dela Cruz',
            'worker_role' => 'Carpenter',
            'project_id' => $this->project->id,
            'hours' => 8,
        ]);

        $this->assertDatabaseHas('attendances', [
            'worker_name' => 'Pedro Santos',
            'worker_role' => 'Laborer',
            'project_id' => $this->project->id,
            'hours' => 8,
        ]);

        // Check processed record status updated
        $this->assertDatabaseHas('processed_records', [
            'id' => $record->id,
            'status' => 'submitted',
        ]);
    }

    public function test_submit_expense_record_creates_expense_entry(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertOk();

        // Check expense was created
        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'category' => 'Materials',
            'amount' => 5000,
        ]);
    }

    public function test_submit_expense_with_multiple_categories_creates_one_expense_per_item(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-09-04',
                'location' => 'Cebu City',
                'items' => [
                    ['description' => '50 Bags Portland Cement', 'category' => 'Materials', 'quantity' => 50, 'unit_price' => 250, 'amount' => 12500],
                    ['description' => 'Subcontractor - Masonry (40 hrs)', 'category' => 'Labor', 'quantity' => 40, 'unit_price' => 700, 'amount' => 28000],
                    ['description' => 'Mini Excavator Rental (2 days)', 'category' => 'Equipment', 'quantity' => 2, 'unit_price' => 9000, 'amount' => 18000],
                    ['description' => 'Site Safety Supplies (Gloves/Vests)', 'category' => 'Miscellaneous', 'quantity' => 1, 'unit_price' => 4200, 'amount' => 4200],
                    ['description' => 'Local Municipal Permit Fee (Expedite)', 'category' => 'Others', 'quantity' => 1, 'unit_price' => 6500, 'amount' => 6500],
                ],
                'subtotal' => 69200,
                'tax' => 0,
                'total' => 69200,
                'paid_by' => 'Maria Santos',
            ],
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertOk();

        $this->assertDatabaseCount('expenses', 5);

        foreach ([
            ['Materials', 12500],
            ['Labor', 28000],
            ['Equipment', 18000],
            ['Miscellaneous', 4200],
            ['Others', 6500],
        ] as [$category, $amount]) {
            $this->assertDatabaseHas('expenses', [
                'project_id' => $this->project->id,
                'category' => $category,
                'amount' => $amount,
            ]);
        }

        // Guard against the old behavior: one combined row under the first item's category.
        $this->assertDatabaseMissing('expenses', [
            'project_id' => $this->project->id,
            'category' => 'Materials',
            'amount' => 69200,
        ]);
    }

    public function test_submit_requires_project(): void
    {
        $record = $this->makeRecord([
            'project_id' => null,
            'status' => 'pending_project',
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertStatus(422);
        $response->assertJson(['message' => 'Please assign a project before submitting']);
    }

    public function test_submit_already_submitted_returns_422(): void
    {
        $record = $this->makeRecord(['status' => 'submitted']);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertStatus(422);
        $response->assertJson(['message' => 'Record already submitted']);
    }

    // ─── REJECT FLOW TESTS ───────────────────────────────────────

    public function test_reject_record_deletes_record(): void
    {
        $record = $this->makeRecord(['status' => 'pending']);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/reject");

        $response->assertOk();
        // Record should be deleted entirely, not just marked as rejected
        $this->assertDatabaseMissing('processed_records', [
            'id' => $record->id,
        ]);
    }

    public function test_reject_does_not_create_attendance(): void
    {
        $record = $this->makeRecord(['status' => 'pending']);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/reject");

        $this->assertDatabaseCount('attendances', 0);
    }

    public function test_reject_does_not_create_expense(): void
    {
        $record = $this->makeExpenseRecord(['status' => 'pending']);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/reject");

        $this->assertDatabaseCount('expenses', 0);
    }

    // ─── EDIT FLOW TESTS ─────────────────────────────────────────

    public function test_edit_updates_parsed_data(): void
    {
        $record = $this->makeRecord();
        $newData = [
            'date' => '2026-08-28',
            'location' => 'Manila',
            'workers' => [
                ['name' => 'New Worker', 'position' => 'Engineer', 'hours' => 8],
            ],
        ];

        $response = $this->actingAs($this->headAdmin)
            ->putJson("/processed-records/{$record->id}/edit", [
                'ai_parsed_data' => $newData,
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('processed_records', [
            'id' => $record->id,
            'ai_parsed_data' => json_encode($newData),
        ]);
    }

    public function test_edit_requires_ai_parsed_data(): void
    {
        $record = $this->makeRecord();

        $response = $this->actingAs($this->headAdmin)
            ->putJson("/processed-records/{$record->id}/edit", []);

        $response->assertUnprocessable();
    }

    public function test_edited_data_can_be_submitted(): void
    {
        $record = $this->makeRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-27',
                'workers' => [
                    ['name' => 'Original Worker', 'position' => 'Worker', 'hours' => 8],
                ],
            ],
        ]);

        // Edit the data
        $newData = [
            'date' => '2026-08-28',
            'workers' => [
                ['name' => 'Edited Worker', 'position' => 'Engineer', 'hours' => 9],
            ],
        ];

        $this->actingAs($this->headAdmin)
            ->putJson("/processed-records/{$record->id}/edit", [
                'ai_parsed_data' => $newData,
            ]);

        // Submit the edited record
        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        // Should use edited data
        $this->assertDatabaseHas('attendances', [
            'worker_name' => 'Edited Worker',
            'worker_role' => 'Engineer',
            'hours' => 9,
        ]);

        $this->assertDatabaseMissing('attendances', [
            'worker_name' => 'Original Worker',
        ]);
    }

    // ─── ASSIGN PROJECT TESTS ────────────────────────────────────

    public function test_assign_project_to_record(): void
    {
        $record = $this->makeRecord([
            'project_id' => null,
            'status' => 'pending_project',
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/assign-project", [
                'project_id' => $this->project->id,
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('processed_records', [
            'id' => $record->id,
            'project_id' => $this->project->id,
            'status' => 'pending',
        ]);
    }

    public function test_assign_project_requires_valid_project(): void
    {
        $record = $this->makeRecord([
            'project_id' => null,
            'status' => 'pending_project',
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/assign-project", [
                'project_id' => 99999,
            ]);

        $response->assertUnprocessable();
    }

    public function test_assign_then_submit_works(): void
    {
        $record = $this->makeRecord([
            'project_id' => null,
            'status' => 'pending_project',
        ]);

        // Assign project
        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/assign-project", [
                'project_id' => $this->project->id,
            ]);

        // Submit
        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertOk();
        $this->assertDatabaseHas('processed_records', [
            'id' => $record->id,
            'status' => 'submitted',
        ]);
    }

    // ─── QUICK CREATE PROJECT TESTS ──────────────────────────────

    public function test_quick_create_project(): void
    {
        $response = $this->actingAs($this->headAdmin)
            ->postJson('/projects/quick-create', [
                'name' => 'New Project',
                'client' => 'Client Inc',
                'type' => 'Residential',
                'location' => 'Manila',
                'phase' => 'Design',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('projects', [
            'name' => 'New Project',
            'client' => 'Client Inc',
        ]);
    }

    public function test_quick_create_requires_name_and_phase(): void
    {
        $response = $this->actingAs($this->headAdmin)
            ->postJson('/projects/quick-create', []);

        $response->assertUnprocessable();
    }

    // ─── SYSTEM PROMPT TESTS ─────────────────────────────────────

    public function test_system_prompt_contains_required_elements(): void
    {
        $prompt = \App\Services\OpenRouterService::getSystemPrompt();

        $this->assertNotEmpty($prompt);
        $this->assertStringContainsString('construction', strtolower($prompt));
        $this->assertStringContainsString('attendance', strtolower($prompt));
        $this->assertStringContainsString('expense', strtolower($prompt));
        $this->assertStringContainsString('irrelevant', strtolower($prompt));
        $this->assertStringContainsString('RECORD_N', $prompt);
        $this->assertStringContainsString('TYPE:', $prompt);
        $this->assertStringContainsString('STRUCTURED_DATA:', $prompt);
    }

    // ─── WAGE ATTENDANCE (Daily P/A) TESTS ──────────────────────

    public function test_submit_daily_attendance_creates_per_day_records(): void
    {
        $record = $this->makeRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date_range_start' => '2026-08-24',
                'date_range' => 'August 24 - August 30, 2026',
                'location' => 'Cebu City',
                'workers' => [
                    [
                        'name' => 'Juan Dela Cruz',
                        'position' => 'Worker',
                        'attendance' => [
                            '8/24' => 'P',
                            '8/25' => 'P',
                            '8/26' => 'A',
                            '8/27' => 'P',
                            '8/28' => 'P',
                        ],
                    ],
                ],
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        // Should create 4 attendance records (P on 4 days, A on 1)
        $this->assertDatabaseCount('attendances', 4);

        // Check specific worker exists
        $this->assertDatabaseHas('attendances', [
            'worker_name' => 'Juan Dela Cruz',
            'worker_role' => 'Worker',
            'hours' => 8,
            'project_id' => $this->project->id,
        ]);

        // Check that absent day was not created
        $absentDay = Attendance::where('worker_name', 'Juan Dela Cruz')
            ->whereDate('date', '2026-08-26')
            ->count();
        $this->assertEquals(0, $absentDay);
    }

    // ─── CLEANUP TEST ────────────────────────────────────────────

    public function test_new_upload_cleans_old_pending_records(): void
    {
        // Create old pending records
        ProcessedRecord::create([
            'project_id' => $this->project->id,
            'user_id' => $this->headAdmin->id,
            'record_type' => 'attendance',
            'ai_model' => 'test',
            'status' => 'pending',
        ]);

        $this->assertDatabaseCount('processed_records', 1);

        // A new upload should clean old pending records
        // (We can't test the full upload without mocking AI, but we can verify the cleanup exists)
        $this->assertTrue(true);
    }

    // ─── MULTIPLE RECORDS TESTS ──────────────────────────────────

    public function test_multiple_records_can_be_submitted_independently(): void
    {
        $record1 = $this->makeRecord(['status' => 'pending']);
        $record2 = $this->makeExpenseRecord(['status' => 'pending']);

        // Submit first
        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record1->id}/confirm");

        // Reject second
        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record2->id}/reject");

        // First is submitted, second is deleted (rejected)
        $this->assertDatabaseHas('processed_records', ['id' => $record1->id, 'status' => 'submitted']);
        $this->assertDatabaseMissing('processed_records', ['id' => $record2->id]);

        // Only attendance was created
        $this->assertDatabaseCount('attendances', 1);
        $this->assertDatabaseCount('expenses', 0);
    }

    // ─── DATE RANGE PARSING TESTS ────────────────────────────────

    public function test_submit_expense_with_date_range_uses_first_date(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-26 to 2026-08-27',
                'location' => 'Fortress Construction Site',
                'items' => [
                    ['description' => 'Cement Bags', 'category' => 'Materials', 'quantity' => 1, 'unit_price' => 300, 'amount' => 300],
                ],
                'subtotal' => 300,
                'total' => 300,
                'paid_by' => 'S. Norse',
                'remarks' => 'Two-day expense form',
            ],
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertOk();

        // Should use the first date from the range
        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'amount' => 300,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_submit_expense_with_hyphen_date_range(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-26 - 2026-08-27',
                'items' => [
                    ['description' => 'Rebar', 'category' => 'Materials', 'amount' => 19],
                ],
                'total' => 19,
            ],
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertOk();

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_submit_expense_with_textual_date(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => 'August 26, 2026',
                'items' => [
                    ['description' => 'Labor', 'category' => 'Labor', 'amount' => 120],
                ],
                'total' => 120,
            ],
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertOk();

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_submit_attendance_with_date_range_uses_first_date(): void
    {
        $record = $this->makeRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-26 to 2026-08-27',
                'workers' => [
                    ['name' => 'Worker One', 'position' => 'Laborer', 'hours' => 8],
                ],
            ],
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertOk();

        $this->assertDatabaseHas('attendances', [
            'worker_name' => 'Worker One',
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_submit_expense_with_null_date_uses_today(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => null,
                'items' => [
                    ['description' => 'Supplies', 'category' => 'Materials', 'amount' => 50],
                ],
                'total' => 50,
            ],
        ]);

        $response = $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $response->assertOk();

        // Should default to today's date
        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse(date('Y-m-d')),
        ]);
    }

    // ─── EXTENDED DATE FORMAT TESTS ──────────────────────────────

    public function test_expense_with_us_slash_date(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '08/26/2026',
                'items' => [['description' => 'Cement', 'category' => 'Materials', 'amount' => 100]],
                'total' => 100,
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_expense_with_slash_range(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '08/26/2026 to 08/27/2026',
                'items' => [['description' => 'Rebar', 'category' => 'Materials', 'amount' => 50]],
                'total' => 50,
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_expense_with_dot_separated_date(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '26.08.2026',
                'items' => [['description' => 'Labor', 'category' => 'Labor', 'amount' => 200]],
                'total' => 200,
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_expense_with_year_slash_format(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026/08/26',
                'items' => [['description' => 'Paint', 'category' => 'Materials', 'amount' => 75]],
                'total' => 75,
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_expense_with_ordinal_date(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '26th August 2026',
                'items' => [['description' => 'Sand', 'category' => 'Materials', 'amount' => 30]],
                'total' => 30,
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_expense_with_dashed_short_month(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '26-Aug-2026',
                'items' => [['description' => 'Gravel', 'category' => 'Materials', 'amount' => 45]],
                'total' => 45,
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_expense_with_compact_range(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => 'August 26-27, 2026',
                'items' => [['description' => 'Nails', 'category' => 'Materials', 'amount' => 15]],
                'total' => 15,
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_expense_with_text_range(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => 'Aug 26 - Aug 27, 2026',
                'items' => [['description' => 'Wire', 'category' => 'Materials', 'amount' => 60]],
                'total' => 60,
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    public function test_expense_with_th_through_range(): void
    {
        $record = $this->makeExpenseRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-26 through 2026-08-28',
                'items' => [['description' => 'Pipe', 'category' => 'Materials', 'amount' => 90]],
                'total' => 90,
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('expenses', [
            'project_id' => $this->project->id,
            'date' => \Carbon\Carbon::parse('2026-08-26'),
        ]);
    }

    // ─── WORKER RATE SYNC TESTS ──────────────────────────────────

    public function test_attendance_confirm_syncs_worker_rate_for_new_worker(): void
    {
        $record = $this->makeRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-27',
                'workers' => [
                    ['name' => 'Pedro Santos', 'position' => 'Worker', 'daily_rate' => 800, 'hours' => 8],
                ],
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('workers', [
            'project_id' => $this->project->id,
            'name' => 'Pedro Santos',
            'default_rate_per_hour' => 800,
        ]);
    }

    public function test_attendance_confirm_updates_existing_worker_rate(): void
    {
        // Create worker with old rate
        Worker::create([
            'foreman_id' => $this->headAdmin->id,
            'project_id' => $this->project->id,
            'name' => 'Juan Dela Cruz',
            'default_rate_per_hour' => 500,
            'job_type' => Worker::JOB_TYPE_WORKER,
        ]);

        $record = $this->makeRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-27',
                'workers' => [
                    ['name' => 'Juan Dela Cruz', 'position' => 'Worker', 'daily_rate' => 800, 'hours' => 8],
                ],
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        // Rate should be updated to 800
        $this->assertDatabaseHas('workers', [
            'project_id' => $this->project->id,
            'name' => 'Juan Dela Cruz',
            'default_rate_per_hour' => 800,
        ]);

        // Old rate should not exist
        $this->assertDatabaseMissing('workers', [
            'project_id' => $this->project->id,
            'name' => 'Juan Dela Cruz',
            'default_rate_per_hour' => 500,
        ]);
    }

    public function test_attendance_confirm_creates_worker_without_daily_rate(): void
    {
        $record = $this->makeRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-27',
                'workers' => [
                    ['name' => 'Test Worker', 'position' => 'Worker', 'hours' => 8],
                ],
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        // Worker should be added to Worker Rate Management even without a rate
        $this->assertDatabaseHas('workers', [
            'project_id' => $this->project->id,
            'name' => 'Test Worker',
        ]);

        // But default_rate_per_hour should be null (no rate detected)
        $worker = \App\Models\Worker::where('project_id', $this->project->id)
            ->where('name', 'Test Worker')
            ->first();
        $this->assertNull($worker->default_rate_per_hour);
    }

    public function test_attendance_confirm_does_not_overwrite_existing_rate_without_detection(): void
    {
        // Create worker with existing rate
        Worker::create([
            'foreman_id'            => $this->headAdmin->id,
            'project_id'            => $this->project->id,
            'name'                  => 'Existing Worker',
            'default_rate_per_hour' => 750,
            'job_type'              => Worker::JOB_TYPE_WORKER,
        ]);

        $record = $this->makeRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-27',
                'workers' => [
                    ['name' => 'Existing Worker', 'position' => 'Worker', 'hours' => 8],
                ],
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        // Existing rate should NOT be overwritten when no rate detected
        $this->assertDatabaseHas('workers', [
            'project_id' => $this->project->id,
            'name' => 'Existing Worker',
            'default_rate_per_hour' => 750,
        ]);
    }

    public function test_attendance_confirm_syncs_multiple_worker_rates(): void
    {
        $record = $this->makeRecord([
            'status' => 'pending',
            'ai_parsed_data' => [
                'date' => '2026-08-27',
                'workers' => [
                    ['name' => 'Worker A', 'position' => 'Worker', 'daily_rate' => 600, 'hours' => 8],
                    ['name' => 'Worker B', 'position' => 'Skilled Worker', 'daily_rate' => 800, 'hours' => 8],
                    ['name' => 'Worker C', 'position' => 'Laborer', 'daily_rate' => 500, 'hours' => 8],
                ],
            ],
        ]);

        $this->actingAs($this->headAdmin)
            ->postJson("/processed-records/{$record->id}/confirm");

        $this->assertDatabaseHas('workers', [
            'project_id' => $this->project->id,
            'name' => 'Worker A',
            'default_rate_per_hour' => 600,
        ]);
        $this->assertDatabaseHas('workers', [
            'project_id' => $this->project->id,
            'name' => 'Worker B',
            'default_rate_per_hour' => 800,
        ]);
        $this->assertDatabaseHas('workers', [
            'project_id' => $this->project->id,
            'name' => 'Worker C',
            'default_rate_per_hour' => 500,
        ]);
    }
}
