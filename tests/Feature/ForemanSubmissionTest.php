<?php

namespace Tests\Feature;

use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ForemanSubmissionTest extends TestCase
{
    use RefreshDatabase;

    private function foreman(string $email = 'submit.foreman@example.test'): User
    {
        return User::create([
            'fullname' => 'Submit Foreman',
            'email' => $email,
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);
    }

    private function project(): Project
    {
        return Project::create([
            'name' => 'Submit Project',
            'client' => 'Submit Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'CONSTRUCTION',
            'overall_progress' => 0,
        ]);
    }

    private function assign(User $foreman, Project $project): void
    {
        ProjectAssignment::create([
            'project_id' => $project->id,
            'user_id' => $foreman->id,
            'role_in_project' => 'foreman',
        ]);
    }

    private function login(string $email): string
    {
        return (string) $this->postJson('/api/foreman/login', [
            'email' => $email,
            'password' => 'password123',
        ])->json('token');
    }

    private function monday(): string
    {
        return Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    public function test_submit_all_stores_attendance_for_current_week(): void
    {
        $foreman = $this->foreman();
        $project = $this->project();
        $this->assign($foreman, $project);
        $token = $this->login($foreman->email);

        $response = $this->post("/api/foreman/projects/{$project->id}/submit-all", [
            'attendance_week_start' => $this->monday(),
            'attendance_entries' => [
                [
                    'worker_name' => 'Site Worker',
                    'worker_role' => 'Mason',
                    'days' => ['mon' => 'P', 'tue' => 'H'],
                ],
            ],
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ]);

        $response->assertOk()
            ->assertJsonPath('submitted.attendance', true);

        $this->assertDatabaseHas('attendances', [
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'worker_name' => 'Site Worker',
            'attendance_code' => 'P',
        ]);
    }

    public function test_submit_all_stores_delivery_material_issue_and_photo(): void
    {
        Storage::fake('public');

        $foreman = $this->foreman('submit2.foreman@example.test');
        $project = $this->project();
        $this->assign($foreman, $project);
        $token = $this->login($foreman->email);

        $response = $this->post("/api/foreman/projects/{$project->id}/submit-all", [
            'delivery_date' => now()->toDateString(),
            'delivery_status' => 'complete',
            'delivery_item_delivered' => 'Cement',
            'delivery_quantity' => '50',
            'delivery_supplier' => 'ABC Supply',
            'delivery_photo' => UploadedFile::fake()->image('delivery.jpg'),
            'material_name' => 'Steel bars',
            'material_quantity' => '20',
            'material_unit' => 'pcs',
            'material_photo' => UploadedFile::fake()->image('material.jpg'),
            'photo_file' => UploadedFile::fake()->image('site.jpg'),
            'photo_category' => 'Masonry',
            'photo_description' => 'Wall progress',
            'issue_title' => 'Blocked access',
            'issue_description' => 'Road blocked by delivery truck',
            'issue_urgency' => 'high',
            'issue_photo' => UploadedFile::fake()->image('issue.jpg'),
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ]);

        $response->assertOk()
            ->assertJsonPath('submitted.delivery', true)
            ->assertJsonPath('submitted.material', true)
            ->assertJsonPath('submitted.photo', true)
            ->assertJsonPath('submitted.issue', true);

        $this->assertDatabaseHas('delivery_confirmations', [
            'foreman_id' => $foreman->id,
            'item_delivered' => 'Cement',
            'status' => 'received',
        ]);
        $this->assertDatabaseHas('material_requests', [
            'foreman_id' => $foreman->id,
            'material_name' => 'Steel bars',
        ]);
        $this->assertDatabaseHas('progress_photos', [
            'foreman_id' => $foreman->id,
            'caption' => '[Masonry] Wall progress',
        ]);
        $this->assertDatabaseHas('issue_reports', [
            'foreman_id' => $foreman->id,
            'issue_title' => 'Blocked access',
        ]);

        // Recents served to mobile must include photo paths so each card
        // shows its own image instead of a placeholder.
        $jotform = $this->getJson("/api/foreman/projects/{$project->id}/jotform", [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertOk();

        $this->assertNotEmpty($jotform->json('recent_deliveries.0.photo_path'));
        $this->assertNotEmpty($jotform->json('recent_material_requests.0.photo_path'));
        $this->assertNotEmpty($jotform->json('recent_photos.0.photo_path'));
        $this->assertNotEmpty($jotform->json('recent_issue_reports.0.photo_path'));
    }

    public function test_submit_all_accepts_medium_and_critical_urgency(): void
    {
        $foreman = $this->foreman('submit9.foreman@example.test');
        $project = $this->project();
        $this->assign($foreman, $project);
        $token = $this->login($foreman->email);

        $this->post("/api/foreman/projects/{$project->id}/submit-all", [
            'issue_title' => 'Medium issue',
            'issue_description' => 'Needs attention soon',
            'issue_urgency' => 'medium',
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertOk();

        $this->assertDatabaseHas('issue_reports', [
            'foreman_id' => $foreman->id,
            'issue_title' => 'Medium issue',
            'severity' => 'medium',
        ]);

        $this->post("/api/foreman/projects/{$project->id}/submit-all", [
            'issue_title' => 'Critical issue',
            'issue_description' => 'Needs immediate action',
            'issue_urgency' => 'critical',
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertOk();

        $this->assertDatabaseHas('issue_reports', [
            'foreman_id' => $foreman->id,
            'issue_title' => 'Critical issue',
            'severity' => 'critical',
        ]);
    }

    public function test_submit_all_stores_weekly_scopes(): void
    {
        $foreman = $this->foreman('submit3.foreman@example.test');
        $project = $this->project();
        $this->assign($foreman, $project);
        $token = $this->login($foreman->email);

        $response = $this->post("/api/foreman/projects/{$project->id}/submit-all", [
            'weekly_week_start' => $this->monday(),
            'weekly_scopes' => [
                ['scope_of_work' => 'Foundation', 'percent_completed' => 50],
            ],
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ]);

        $response->assertOk()
            ->assertJsonPath('submitted.weekly', true);

        $this->assertDatabaseHas('weekly_accomplishments', [
            'foreman_id' => $foreman->id,
            'project_id' => $project->id,
            'scope_of_work' => 'Foundation',
        ]);
    }

    public function test_submit_all_stores_weekly_scope_photos(): void
    {
        Storage::fake('public');

        $foreman = $this->foreman('submit8.foreman@example.test');
        $project = $this->project();
        $this->assign($foreman, $project);
        $token = $this->login($foreman->email);

        $response = $this->post("/api/foreman/projects/{$project->id}/submit-all", [
            'weekly_week_start' => $this->monday(),
            'weekly_scopes' => [
                [
                    'scope_of_work' => 'Foundation',
                    'percent_completed' => 60,
                    'photo_caption' => 'Footing done',
                    'photos' => [UploadedFile::fake()->image('scope.jpg')],
                ],
            ],
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ]);

        $response->assertOk()
            ->assertJsonPath('submitted.weekly', true);

        $caption = (string) \App\Models\ScopePhoto::query()->value('caption');
        $this->assertStringContainsString('Foundation', $caption);
        $this->assertStringContainsString('Footing done', $caption);
    }

    public function test_submit_all_rejects_empty_submission(): void
    {
        $foreman = $this->foreman('submit4.foreman@example.test');
        $project = $this->project();
        $this->assign($foreman, $project);
        $token = $this->login($foreman->email);

        $this->post("/api/foreman/projects/{$project->id}/submit-all", [], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertStatus(422);
    }

    public function test_submit_all_rejects_unassigned_project(): void
    {
        $foreman = $this->foreman('submit5.foreman@example.test');
        $project = $this->project();
        $token = $this->login($foreman->email);

        $this->post("/api/foreman/projects/{$project->id}/submit-all", [
            'issue_title' => 'X',
            'issue_description' => 'Y',
        ], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertForbidden();
    }

    public function test_foreman_can_delete_own_delivery_material_photo_and_issue(): void
    {
        $foreman = $this->foreman('submit6.foreman@example.test');
        $project = $this->project();
        $this->assign($foreman, $project);
        $token = $this->login($foreman->email);
        $headers = ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'];

        $delivery = DeliveryConfirmation::create([
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'item_delivered' => 'Cement',
            'quantity' => '10',
            'delivery_date' => now()->toDateString(),
            'status' => 'received',
        ]);
        $material = MaterialRequest::create([
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'material_name' => 'Sand',
            'quantity' => '5',
            'unit' => 'bags',
            'status' => 'pending',
        ]);
        $photo = ProgressPhoto::create([
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'photo_path' => 'some/path.jpg',
            'caption' => 'Test',
        ]);
        $issue = IssueReport::create([
            'project_id' => $project->id,
            'foreman_id' => $foreman->id,
            'issue_title' => 'Issue',
            'description' => 'Desc',
            'severity' => 'medium',
            'status' => 'open',
        ]);

        $this->deleteJson("/api/foreman/deliveries/{$delivery->id}", [], $headers)->assertOk();
        $this->deleteJson("/api/foreman/materials/{$material->id}", [], $headers)->assertOk();
        $this->deleteJson("/api/foreman/photos/{$photo->id}", [], $headers)->assertOk();
        $this->deleteJson("/api/foreman/issues/{$issue->id}", [], $headers)->assertOk();

        $this->assertSoftDeleted('delivery_confirmations', ['id' => $delivery->id]);
        $this->assertSoftDeleted('material_requests', ['id' => $material->id]);
        $this->assertSoftDeleted('progress_photos', ['id' => $photo->id]);
        $this->assertSoftDeleted('issue_reports', ['id' => $issue->id]);
    }

    public function test_foreman_cannot_delete_another_foremans_records(): void
    {
        $owner = $this->foreman('submit7.owner@example.test');
        $other = $this->foreman('submit7.other@example.test');
        $project = $this->project();

        $delivery = DeliveryConfirmation::create([
            'project_id' => $project->id,
            'foreman_id' => $owner->id,
            'item_delivered' => 'Cement',
            'quantity' => '10',
            'delivery_date' => now()->toDateString(),
            'status' => 'received',
        ]);

        $token = $this->login($other->email);

        $this->deleteJson("/api/foreman/deliveries/{$delivery->id}", [], [
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->assertNotFound();
    }
}
