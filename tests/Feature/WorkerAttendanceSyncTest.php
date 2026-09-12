<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\ProcessedRecord;
use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use App\Models\Worker;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Worker lifecycle vs attendance grids:
 *
 * - Deleting a worker in HR hides their rows from the foreman jotform and
 *   the mobile attendance grids (history rows are kept).
 * - Re-encountering the same worker (jotform/mobile submit, AI confirm,
 *   HR re-add) restores the record instead of creating a duplicate.
 */
class WorkerAttendanceSyncTest extends TestCase
{
    use RefreshDatabase;

    private User $foreman;

    private User $hr;

    private Project $project;

    private ProgressSubmitToken $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->foreman = User::create([
            'fullname' => 'Sync Foreman',
            'email' => 'sync.foreman@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_FOREMAN,
        ]);

        $this->hr = User::create([
            'fullname' => 'Sync HR',
            'email' => 'sync.hr@example.test',
            'password' => Hash::make('password123'),
            'role' => User::ROLE_HR,
        ]);

        $this->project = Project::create([
            'name' => 'Sync Project',
            'client' => 'Sync Client',
            'type' => 'Residential',
            'location' => 'Antipolo City',
            'status' => 'ONGOING',
            'phase' => 'Construction',
            'overall_progress' => 0,
        ]);

        ProjectAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->foreman->id,
            'role_in_project' => 'foreman',
        ]);

        $this->token = ProgressSubmitToken::create([
            'project_id' => $this->project->id,
            'foreman_id' => $this->foreman->id,
            'token' => 'sync-token',
        ]);
    }

    private function monday(): string
    {
        return Carbon::now('Asia/Manila')->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    private function makeWorker(string $name = 'Gone Guy'): Worker
    {
        return Worker::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'name' => $name,
            'job_type' => 'Mason',
        ]);
    }

    private function makeAttendance(string $name, string $date, string $code = 'P'): void
    {
        Attendance::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'worker_name' => $name,
            'worker_role' => 'Mason',
            'date' => $date,
            'hours' => 8,
            'attendance_code' => $code,
        ]);
    }

    private function mobileHeaders(): array
    {
        $token = (string) $this->postJson('/api/foreman/login', [
            'email' => 'sync.foreman@example.test',
            'password' => 'password123',
        ])->json('token');

        return ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'];
    }

    private function webGridHasWorker(string $name): bool
    {
        $response = $this->get("/progress-submit/{$this->token->token}")->assertOk();
        $byWeek = $this->inertiaProp($response, 'submitToken.attendance_saved_by_week');

        return collect($byWeek)->flatten(1)->contains(fn ($row) => trim((string) ($row['worker_name'] ?? '')) === $name);
    }

    private function inertiaProp($response, string $path)
    {
        $page = $response->viewData('page');
        $props = is_array($page) ? ($page['props'] ?? []) : [];

        return data_get($props, $path);
    }

    private function mobileGridHasWorker(string $name): bool
    {
        $payload = $this->getJson(
            "/api/foreman/projects/{$this->project->id}/jotform",
            $this->mobileHeaders()
        )->assertOk()->json();

        return collect($payload['attendance_saved_by_week'] ?? [])
            ->flatten(1)
            ->contains(fn ($row) => trim((string) ($row['worker_name'] ?? '')) === $name);
    }

    public function test_deleted_worker_vanishes_from_web_and_mobile_grids_but_history_kept(): void
    {
        $worker = $this->makeWorker();
        $this->makeAttendance('Gone Guy', $this->monday());
        $this->makeAttendance('Stay Guy', $this->monday());
        Worker::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'name' => 'Stay Guy',
            'job_type' => 'Worker',
        ]);

        $this->assertTrue($this->webGridHasWorker('Gone Guy'));
        $this->assertTrue($this->mobileGridHasWorker('Gone Guy'));

        $this->actingAs($this->hr)
            ->delete("/hr/workers/{$worker->id}")
            ->assertRedirect();

        $this->assertTrue($worker->fresh()->trashed());
        $this->assertFalse($this->webGridHasWorker('Gone Guy'));
        $this->assertFalse($this->mobileGridHasWorker('Gone Guy'));

        // Untouched workers still show.
        $this->assertTrue($this->webGridHasWorker('Stay Guy'));
        $this->assertTrue($this->mobileGridHasWorker('Stay Guy'));

        // History rows are kept for payroll/audit.
        $this->assertSame(
            1,
            Attendance::query()
                ->where('project_id', $this->project->id)
                ->where('worker_name', 'Gone Guy')
                ->count()
        );
    }

    public function test_jotform_submit_restores_deleted_worker_without_duplicate(): void
    {
        $this->makeWorker()->delete();

        $this->post("/progress-submit/{$this->token->token}/submit-all", [
            'attendance_week_start' => $this->monday(),
            'attendance_entries' => [
                [
                    'worker_name' => 'Gone Guy',
                    'worker_role' => 'Mason',
                    'days' => ['mon' => 'P', 'tue' => '', 'wed' => '', 'thu' => '', 'fri' => '', 'sat' => '', 'sun' => ''],
                ],
            ],
        ])->assertRedirect();

        $this->assertSame(
            1,
            Worker::withTrashed()->where('foreman_id', $this->foreman->id)->where('name', 'Gone Guy')->count()
        );
        $this->assertFalse(
            Worker::withTrashed()->where('foreman_id', $this->foreman->id)->where('name', 'Gone Guy')->first()->trashed()
        );
        $this->assertTrue($this->webGridHasWorker('Gone Guy'));
    }

    public function test_mobile_submit_restores_deleted_worker_without_duplicate(): void
    {
        $this->makeWorker()->delete();

        $this->post("/api/foreman/projects/{$this->project->id}/submit-all", [
            'attendance_week_start' => $this->monday(),
            'attendance_entries' => [
                [
                    'worker_name' => 'Gone Guy',
                    'worker_role' => 'Mason',
                    'days' => ['mon' => 'P', 'tue' => '', 'wed' => '', 'thu' => '', 'fri' => '', 'sat' => '', 'sun' => ''],
                ],
            ],
        ], $this->mobileHeaders())->assertOk();

        $this->assertSame(
            1,
            Worker::withTrashed()->where('foreman_id', $this->foreman->id)->where('name', 'Gone Guy')->count()
        );
        $this->assertTrue($this->mobileGridHasWorker('Gone Guy'));
    }

    public function test_ai_confirm_restores_deleted_worker_without_duplicate(): void
    {
        $this->makeWorker()->delete();

        $record = ProcessedRecord::create([
            'project_id' => $this->project->id,
            'user_id' => $this->foreman->id,
            'record_type' => 'attendance',
            'ai_parsed_data' => [
                'workers' => [
                    ['name' => 'Gone Guy', 'position' => 'Mason', 'days_present' => 5],
                ],
            ],
            'status' => 'pending',
        ]);

        $this->post("/api/foreman/ai-attendance/records/{$record->id}/confirm", [], $this->mobileHeaders())
            ->assertOk();

        $this->assertSame(
            1,
            Worker::withTrashed()->where('foreman_id', $this->foreman->id)->where('name', 'Gone Guy')->count()
        );
        $this->assertFalse(
            Worker::withTrashed()->where('foreman_id', $this->foreman->id)->where('name', 'Gone Guy')->first()->trashed()
        );
    }

    public function test_ai_rescan_with_same_workers_creates_no_duplicates(): void
    {
        $makeRecord = fn () => ProcessedRecord::create([
            'project_id' => $this->project->id,
            'user_id' => $this->foreman->id,
            'record_type' => 'attendance',
            'ai_parsed_data' => [
                'workers' => [
                    ['name' => 'Scan Guy', 'position' => 'Worker', 'days_present' => 3],
                ],
            ],
            'status' => 'pending',
        ]);

        $this->post("/api/foreman/ai-attendance/records/{$makeRecord()->id}/confirm", [], $this->mobileHeaders())
            ->assertOk();
        $this->post("/api/foreman/ai-attendance/records/{$makeRecord()->id}/confirm", [], $this->mobileHeaders())
            ->assertOk();

        $this->assertSame(
            1,
            Worker::query()->where('foreman_id', $this->foreman->id)->where('name', 'Scan Guy')->count()
        );
    }

    public function test_hr_readd_restores_deleted_worker_without_duplicate(): void
    {
        $this->makeWorker()->delete();

        $this->actingAs($this->hr)
            ->post('/hr/workers', [
                'foreman_id' => $this->foreman->id,
                'project_id' => $this->project->id,
                'name' => 'Gone Guy',
                'job_type' => 'Worker',
            ])
            ->assertRedirect();

        $this->assertSame(
            1,
            Worker::withTrashed()->where('foreman_id', $this->foreman->id)->where('name', 'Gone Guy')->count()
        );
        $this->assertFalse(
            Worker::withTrashed()->where('foreman_id', $this->foreman->id)->where('name', 'Gone Guy')->first()->trashed()
        );
    }

    public function test_editing_ai_variant_row_updates_instead_of_duplicating(): void
    {
        Worker::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'name' => 'Ai Guy',
            'job_type' => 'Mason',
        ]);
        // AI-saved row carries the extracted position, not the registered role.
        Attendance::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'worker_name' => 'Ai Guy',
            'worker_role' => 'Legal',
            'date' => $this->monday(),
            'hours' => 8,
            'attendance_code' => 'P',
        ]);

        // The grid shows the normalized role; editing it must update the
        // same worker+day instead of inserting a twin row.
        $this->post("/progress-submit/{$this->token->token}/submit-all", [
            'attendance_week_start' => $this->monday(),
            'attendance_entries' => [
                [
                    'worker_name' => 'Ai Guy',
                    'worker_role' => 'Mason',
                    'days' => ['mon' => 'A', 'tue' => '', 'wed' => '', 'thu' => '', 'fri' => '', 'sat' => '', 'sun' => ''],
                ],
            ],
        ])->assertRedirect();

        $this->assertSame(
            1,
            Attendance::query()
                ->where('project_id', $this->project->id)
                ->where('worker_name', 'Ai Guy')
                ->whereDate('date', $this->monday())
                ->count()
        );
        $this->assertSame(
            'A',
            Attendance::query()
                ->where('project_id', $this->project->id)
                ->where('worker_name', 'Ai Guy')
                ->whereDate('date', $this->monday())
                ->value('attendance_code')
        );
    }

    public function test_mobile_edit_of_ai_variant_row_updates_instead_of_duplicating(): void
    {
        Worker::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'name' => 'Ai Mobile Guy',
            'job_type' => 'Mason',
        ]);
        Attendance::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'worker_name' => 'Ai Mobile Guy',
            'worker_role' => 'Legal',
            'date' => $this->monday(),
            'hours' => 8,
            'attendance_code' => 'P',
        ]);

        $this->post("/api/foreman/projects/{$this->project->id}/submit-all", [
            'attendance_week_start' => $this->monday(),
            'attendance_entries' => [
                [
                    'worker_name' => 'Ai Mobile Guy',
                    'worker_role' => 'Mason',
                    'days' => ['mon' => 'H', 'tue' => '', 'wed' => '', 'thu' => '', 'fri' => '', 'sat' => '', 'sun' => ''],
                ],
            ],
        ], $this->mobileHeaders())->assertOk();

        $this->assertSame(
            1,
            Attendance::query()
                ->where('project_id', $this->project->id)
                ->where('worker_name', 'Ai Mobile Guy')
                ->whereDate('date', $this->monday())
                ->count()
        );
        $this->assertSame(
            'H',
            Attendance::query()
                ->where('project_id', $this->project->id)
                ->where('worker_name', 'Ai Mobile Guy')
                ->whereDate('date', $this->monday())
                ->value('attendance_code')
        );
    }

    public function test_clearing_a_cell_removes_all_role_twins(): void
    {
        foreach (['Legal', 'Mason'] as $role) {
            Attendance::create([
                'foreman_id' => $this->foreman->id,
                'project_id' => $this->project->id,
                'worker_name' => 'Twin Guy',
                'worker_role' => $role,
                'date' => $this->monday(),
                'hours' => 8,
                'attendance_code' => 'P',
            ]);
        }

        // Clear Monday (keep Tuesday marked so the entry is submitted).
        $tuesday = Carbon::parse($this->monday())->addDay()->toDateString();
        $this->post("/progress-submit/{$this->token->token}/submit-all", [
            'attendance_week_start' => $this->monday(),
            'attendance_entries' => [
                [
                    'worker_name' => 'Twin Guy',
                    'worker_role' => 'Mason',
                    'days' => ['mon' => '', 'tue' => 'P', 'wed' => '', 'thu' => '', 'fri' => '', 'sat' => '', 'sun' => ''],
                ],
            ],
        ])->assertRedirect();

        $this->assertSame(
            0,
            Attendance::query()
                ->where('project_id', $this->project->id)
                ->where('worker_name', 'Twin Guy')
                ->whereDate('date', $this->monday())
                ->count()
        );
        $this->assertSame(
            1,
            Attendance::query()
                ->where('project_id', $this->project->id)
                ->where('worker_name', 'Twin Guy')
                ->whereDate('date', $tuesday)
                ->count()
        );
    }

    public function test_worker_with_active_duplicate_keeps_showing_and_saving(): void
    {
        // Active record plus a trashed same-name duplicate (e.g. from an
        // older duplicate-creating flow): the worker must keep showing in
        // both grids and edits must persist.
        $this->makeWorker('Twin Name');
        Worker::create([
            'foreman_id' => $this->foreman->id,
            'project_id' => $this->project->id,
            'name' => 'Twin Name',
            'job_type' => 'Worker',
        ])->delete();

        $this->makeAttendance('Twin Name', $this->monday(), 'P');

        $this->assertTrue($this->webGridHasWorker('Twin Name'));
        $this->assertTrue($this->mobileGridHasWorker('Twin Name'));

        $this->post("/progress-submit/{$this->token->token}/submit-all", [
            'attendance_week_start' => $this->monday(),
            'attendance_entries' => [
                [
                    'worker_name' => 'Twin Name',
                    'worker_role' => 'Worker',
                    'days' => ['mon' => 'A', 'tue' => '', 'wed' => '', 'thu' => '', 'fri' => '', 'sat' => '', 'sun' => ''],
                ],
            ],
        ])->assertRedirect();

        $this->assertSame(
            'A',
            Attendance::query()
                ->where('project_id', $this->project->id)
                ->where('worker_name', 'Twin Name')
                ->whereDate('date', $this->monday())
                ->value('attendance_code')
        );
        $this->assertTrue($this->webGridHasWorker('Twin Name'));
        $this->assertTrue($this->mobileGridHasWorker('Twin Name'));
    }

    public function test_ai_reconfirm_does_not_duplicate_attendance_rows(): void
    {
        $makeRecord = fn () => ProcessedRecord::create([
            'project_id' => $this->project->id,
            'user_id' => $this->foreman->id,
            'record_type' => 'attendance',
            'ai_parsed_data' => [
                'date_range' => '2026-09-07 to 2026-09-13',
                'workers' => [
                    ['name' => 'Rescan Guy', 'position' => 'Worker', 'attendance' => ['9/7' => 'P']],
                ],
            ],
            'status' => 'pending',
        ]);

        $this->actingAs($this->foreman)
            ->postJson("/processed-records/{$makeRecord()->id}/confirm")
            ->assertOk();
        $this->actingAs($this->foreman)
            ->postJson("/processed-records/{$makeRecord()->id}/confirm")
            ->assertOk();

        $this->assertSame(
            1,
            Attendance::query()
                ->where('project_id', $this->project->id)
                ->where('worker_name', 'Rescan Guy')
                ->whereDate('date', '2026-09-07')
                ->count()
        );
    }
}
