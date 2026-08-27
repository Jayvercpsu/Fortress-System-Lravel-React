<?php
/**
 * Playwright test-data loader.
 *
 * Single source of truth: tests/e2e/fixtures/test-data.yml
 *
 * This file is NOT a Seeder class and contains NO data. It boots Laravel
 * (run via `php artisan tinker <this-file>` from global.setup.ts), reads the
 * YAML fixture, and inserts rows into the dedicated playwright.sqlite database
 * in dependency order, resolving foreign keys by name / email.
 *
 * Migrations are NOT modified; project data definition lives entirely in the
 * YAML fixture.
 */

use App\Models\User;
use App\Models\UserDetail;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Yaml\Yaml;

require dirname(__DIR__, 3) . '/vendor/autoload.php';

$app = require_once dirname(__DIR__, 3) . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$yamlPath = __DIR__ . '/test-data.yml';

if (! is_file($yamlPath)) {
    fwrite(STDERR, "[load-test-data] Missing fixture: {$yamlPath}\n");
    exit(1);
}

$data = Yaml::parseFile($yamlPath);

if (! is_array($data)) {
    fwrite(STDERR, "[load-test-data] test-data.yml did not parse to an array\n");
    exit(1);
}

function out(string $message): void
{
    if (! app()->runningInConsole() || app()->runningUnitTests()) {
        return;
    }
    fwrite(STDOUT, $message . PHP_EOL);
}

// ---------------------------------------------------------------------------
// Schema sync (defensive, throwaway test DB only)
// ---------------------------------------------------------------------------
// The 000015 migration that adds users.default_rate_per_hour is recorded but
// does not apply on SQLite in every environment. Seed data needs the column
// (the production MySQL schema has it), so ensure it exists here. No migration
// files are modified.
function ensureColumn(string $table, string $column, string $definition): void
{
    if (! Schema::hasColumn($table, $column)) {
        Schema::table($table, function ($table) use ($column, $definition): void {
            $table->{$definition}($column)->nullable();
        });
    }
}

ensureColumn('users', 'default_rate_per_hour', 'decimal'); // decimal(10,2)

function section(array $data, string $key): array
{
    $value = $data[$key] ?? null;
    return is_array($value) ? $value : [];
}

function required(array $row, string $key): void
{
    if (! array_key_exists($key, $row) || $row[$key] === null) {
        throw new RuntimeException('[load-test-data] Missing key "'.$key.'" in a seeded row.');
    }
}

out('[load-test-data] Seeding from test-data.yml');

// ---------------------------------------------------------------------------
// Accounts (users) + optional user details
// ---------------------------------------------------------------------------
$userByEmail = [];
$userByFullname = [];

foreach (section($data, 'accounts') as $row) {
    required($row, 'email');
    $attrs = [
        'email' => $row['email'],
        'password' => $row['password'] ?? 'password',
        'role' => $row['role'] ?? 'user',
        'fullname' => $row['fullname'] ?? $row['email'],
    ];
    if (array_key_exists('default_rate_per_hour', $row)) {
        $attrs['default_rate_per_hour'] = $row['default_rate_per_hour'];
    }
    if (! empty($row['username'])) {
        $attrs['username'] = $row['username'];
    }

    $user = User::query()->updateOrCreate(['email' => $row['email']], $attrs);
    $userByEmail[$user->email] = $user->id;
    $userByFullname[$user->fullname] = $user->id;

    $detail = $row['detail'] ?? null;
    if (is_array($detail) && $detail !== []) {
        UserDetail::query()->updateOrCreate(['user_id' => $user->id], $detail);
    }
}

// ---------------------------------------------------------------------------
// Projects (explicit ids preserved; references resolved by name)
// ---------------------------------------------------------------------------
$projectIdByName = [];

foreach (section($data, 'projects') as $project) {
    required($project, 'name');
    $attrs = collect($project)
        ->except(['id', 'source_project'])
        ->all();
    $id = DB::table('projects')->insertGetId($attrs);
    if (isset($project['id'])) {
        DB::table('projects')->where('id', $id)->update(['id' => (int) $project['id']]);
        $id = (int) $project['id'];
    }
    $projectIdByName[$project['name']] = $id;
}

foreach (section($data, 'projects') as $project) {
    if (! empty($project['source_project']) && isset($projectIdByName[$project['name']])) {
        $source = $project['source_project'];
        if (isset($projectIdByName[$source])) {
            DB::table('projects')->where('id', $projectIdByName[$project['name']])
                ->update(['source_project_id' => $projectIdByName[$source]]);
        }
    }
}

// ---------------------------------------------------------------------------
// Design / build project trackers
// ---------------------------------------------------------------------------
foreach (section($data, 'design_projects') as $row) {
    required($row, 'project');
    DB::table('design_projects')->updateOrInsert(
        ['project_id' => $projectIdByName[$row['project']]],
        collect($row)->except('project')->all()
    );
}

foreach (section($data, 'build_projects') as $row) {
    required($row, 'project');
    DB::table('build_projects')->updateOrInsert(
        ['project_id' => $projectIdByName[$row['project']]],
        collect($row)->except('project')->all()
    );
}

// ---------------------------------------------------------------------------
// Project assignments
// ---------------------------------------------------------------------------
foreach (section($data, 'project_assignments') as $row) {
    required($row, 'project');
    $userId = isset($row['user_email'])
        ? $userByEmail[$row['user_email']]
        : $userByFullname[$row['user_fullname']];
    $createdAt = $row['created_at'] ?? now();
    DB::table('project_assignments')->insert([
        'project_id' => $projectIdByName[$row['project']],
        'user_id' => $userId,
        'role_in_project' => $row['role_in_project'] ?? 'foreman',
        'created_at' => $createdAt,
        'updated_at' => $row['updated_at'] ?? $createdAt,
    ]);
}

// ---------------------------------------------------------------------------
// Workers (attached to a foreman by email and a project by name)
// ---------------------------------------------------------------------------
$workerIdByName = [];

foreach (section($data, 'workers') as $row) {
    required($row, 'foreman_email');
    required($row, 'name');
    $projectId = isset($row['project']) ? $projectIdByName[$row['project']] : null;
    $worker = DB::table('workers')->insertGetId(collect($row)
        ->except(['foreman_email', 'project'])
        ->merge([
            'foreman_id' => $userByEmail[$row['foreman_email']],
            'project_id' => $projectId,
        ])
        ->all());
    $workerIdByName[$row['name']] = $worker;
}

// ---------------------------------------------------------------------------
// Project scopes (assigned personnel resolved by fullname)
// ---------------------------------------------------------------------------
$scopeIdByName = [];

foreach (section($data, 'project_scopes') as $row) {
    required($row, 'project');
    required($row, 'scope_name');
    $projectId = $projectIdByName[$row['project']];
    $scope = DB::table('project_scopes')->insertGetId(collect($row)
        ->except(['project'])
        ->merge(['project_id' => $projectId])
        ->all());
    $scopeIdByName[$row['scope_name']] = $scope;
}

// ---------------------------------------------------------------------------
// Scope photos (referenced by scope name)
// ---------------------------------------------------------------------------
foreach (section($data, 'scope_photos') as $row) {
    required($row, 'scope');
    DB::table('scope_photos')->insert([
        'project_scope_id' => $scopeIdByName[$row['scope']],
        'photo_path' => $row['photo'] ?? null,
        'caption' => $row['caption'] ?? null,
        'created_at' => $row['created_at'] ?? now(),
        'updated_at' => $row['updated_at'] ?? ($row['created_at'] ?? now()),
    ]);
}

// ---------------------------------------------------------------------------
// Project workers (adhoc workers on a project)
// ---------------------------------------------------------------------------
foreach (section($data, 'project_workers') as $row) {
    required($row, 'project');
    $createdAt = $row['created_at'] ?? now();
    DB::table('project_workers')->insert([
        'project_id' => $projectIdByName[$row['project']],
        'user_id' => isset($row['user_email']) ? $userByEmail[$row['user_email']] : null,
        'worker_name' => $row['worker_name'],
        'rate' => $row['rate'] ?? 0,
        'created_at' => $createdAt,
        'updated_at' => $row['updated_at'] ?? $createdAt,
    ]);
}

// ---------------------------------------------------------------------------
// Materials (the app's material category list lives in the materials table)
// ---------------------------------------------------------------------------
foreach (section($data, 'materials') as $row) {
    DB::table('materials')->updateOrInsert(['name' => $row['name']], collect($row)->all());
}

// ---------------------------------------------------------------------------
// Payments, expenses, progress submit tokens
// ---------------------------------------------------------------------------
foreach (section($data, 'payments') as $row) {
    required($row, 'project');
    DB::table('payments')->insert(collect($row)
        ->except(['project'])
        ->merge(['project_id' => $projectIdByName[$row['project']]])
        ->all());
}

foreach (section($data, 'expenses') as $row) {
    required($row, 'project');
    DB::table('expenses')->insert(collect($row)
        ->except(['project'])
        ->merge(['project_id' => $projectIdByName[$row['project']]])
        ->all());
}

foreach (section($data, 'progress_submit_tokens') as $row) {
    required($row, 'project');
    DB::table('progress_submit_tokens')->insert(collect($row)
        ->except(['project', 'foreman'])
        ->merge([
            'project_id' => $projectIdByName[$row['project']],
            'foreman_id' => $userByFullname[$row['foreman']] ?? null,
        ])
        ->all());
}

// ---------------------------------------------------------------------------
// Attendance
// - foreman_self_logs: real time in/out entries per foreman
// - worker_weekly_codes: { foreman_email, worker_name, weeks: { '<monday>': [codes] } }
//   code hours: P=8, A=0, H=4, R=0, F=0
// ---------------------------------------------------------------------------
$attendanceCodeHours = ['P' => 8.0, 'A' => 0.0, 'H' => 4.0, 'R' => 0.0, 'F' => 0.0];
$workerRoleByName = collect(DB::table('workers')->get())
    ->mapWithKeys(fn ($w) => [trim((string) $w->name) => trim((string) $w->job_type) ?: 'Worker']);

foreach (section($data, 'attendance') as $group => $payload) {
    if ($group === 'foreman_self_logs') {
        foreach ($payload as $row) {
            required($row, 'foreman_email');
            foreach ($row['entries'] ?? [] as $entry) {
                $date = Carbon::parse($entry['date']);
                $in = Carbon::parse($entry['date'].' '.$entry['time_in']);
                $out = Carbon::parse($entry['date'].' '.$entry['time_out']);
                $hours = round(abs($out->diffInMinutes($in)) / 60, 2);
                $timestamp = $date->copy()->setTime(18, 0, 0)->toDateTimeString();
                DB::table('attendances')->insert([
                    'foreman_id' => $userByEmail[$row['foreman_email']],
                    'project_id' => isset($row['project']) ? $projectIdByName[$row['project']] : null,
                    'worker_name' => $row['worker_name'] ?? $userByEmail[$row['foreman_email']],
                    'worker_role' => 'Foreman',
                    'date' => $entry['date'],
                    'time_in' => $entry['time_in'],
                    'time_out' => $entry['time_out'],
                    'hours' => $hours,
                    'attendance_code' => null,
                    'selfie_path' => null,
                    'created_at' => $timestamp,
                    'updated_at' => $timestamp,
                ]);
            }
        }
    }

    if ($group === 'worker_weekly_codes') {
        foreach ($payload as $row) {
            required($row, 'foreman_email');
            required($row, 'worker_name');
            foreach ($row['weeks'] ?? [] as $weekStart => $codes) {
                $weekStartDate = Carbon::parse($weekStart);
                foreach ($codes as $offset => $code) {
                    $date = $weekStartDate->copy()->addDays((int) $offset);
                    $timestamp = $date->copy()->setTime(18, 10, 0)->toDateTimeString();
                    DB::table('attendances')->insert([
                        'foreman_id' => $userByEmail[$row['foreman_email']],
                        'project_id' => isset($row['project']) ? $projectIdByName[$row['project']] : null,
                        'worker_name' => $row['worker_name'],
                        'worker_role' => $workerRoleByName->get($row['worker_name'], 'Worker'),
                        'date' => $date->toDateString(),
                        'time_in' => null,
                        'time_out' => null,
                        'hours' => $attendanceCodeHours[$code] ?? 0,
                        'attendance_code' => $code,
                        'selfie_path' => null,
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]);
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Weekly accomplishments (foreman resolved by fullname)
// ---------------------------------------------------------------------------
foreach (section($data, 'weekly_accomplishments') as $row) {
    required($row, 'project');
    DB::table('weekly_accomplishments')->insert(collect($row)
        ->except(['project', 'foreman'])
        ->merge([
            'project_id' => $projectIdByName[$row['project']],
            'foreman_id' => $userByFullname[$row['foreman']] ?? null,
            'created_at' => $row['created_at'] ?? now(),
            'updated_at' => $row['updated_at'] ?? ($row['created_at'] ?? now()),
        ])
        ->all());
}

// ---------------------------------------------------------------------------
// Project updates
// ---------------------------------------------------------------------------
foreach (section($data, 'project_updates') as $row) {
    required($row, 'project');
    DB::table('project_updates')->insert(collect($row)
        ->except(['project', 'created_by'])
        ->merge([
            'project_id' => $projectIdByName[$row['project']],
            'created_by' => $userByFullname[$row['created_by']] ?? null,
        ])
        ->all());
}

// ---------------------------------------------------------------------------
// Payroll cutoffs (literal historical rows)
// ---------------------------------------------------------------------------
foreach (section($data, 'payroll_cutoffs') as $row) {
    $exists = DB::table('payroll_cutoffs')
        ->where('start_date', $row['start_date'])
        ->where('end_date', $row['end_date'])
        ->exists();
    if (! $exists) {
        DB::table('payroll_cutoffs')->insert([
            'start_date' => $row['start_date'],
            'end_date' => $row['end_date'],
            'status' => $row['status'] ?? 'generated',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}

// ---------------------------------------------------------------------------
// Payroll: rebuilt per payroll week from attendance, then deductions/overrides
// ---------------------------------------------------------------------------
$payrollUserEmail = $data['payroll_user'] ?? 'headadmin@buildbooks.com';

foreach (section($data, 'payroll_weeks') as $week) {
    $start = $week['start_date'];
    $end = $week['end_date'];

    $constructionName = $data['payroll_project_name'] ?? 'Fortress Building';
    $projectId = $projectIdByName[$constructionName];
    $projectName = (string) DB::table('projects')->where('id', $projectId)->value('name');
    $projectClient = (string) DB::table('projects')->where('id', $projectId)->value('client');
    $payrollUserId = $userByEmail[$payrollUserEmail] ?? null;

    DB::table('payroll_cutoffs')->updateOrInsert(
        ['start_date' => $start, 'end_date' => $end],
        ['status' => 'generated']
    );
    $cutoff = DB::table('payroll_cutoffs')->where('start_date', $start)->where('end_date', $end)->first();
    $cutoffId = (int) $cutoff->id;

    DB::table('payrolls')->where('cutoff_id', $cutoffId)->delete();

    $summary = DB::table('attendances')
        ->where('project_id', $projectId)
        ->whereBetween('date', [$start, $end])
        ->selectRaw('worker_name, worker_role, COALESCE(SUM(hours),0) as total_hours')
        ->groupBy('worker_name', 'worker_role')
        ->orderBy('worker_name')
        ->get();

    foreach ($summary as $row) {
        $hours = round((float) $row->total_hours, 2);
        $rate = $row->worker_role === 'Foreman'
            ? (float) (DB::table('users')->where('fullname', $row->worker_name)->value('default_rate_per_hour') ?? 0)
            : (float) (DB::table('workers')->where('project_id', $projectId)->where('name', $row->worker_name)->value('default_rate_per_hour') ?? 0);
        $gross = round($hours * $rate, 2);
        DB::table('payrolls')->insert([
            'user_id' => $payrollUserId,
            'cutoff_id' => $cutoffId,
            'project_id' => $projectId,
            'project_name' => $projectName,
            'project_client' => $projectClient,
            'worker_name' => $row->worker_name,
            'role' => $row->worker_role ?: 'Labor',
            'hours' => $hours,
            'rate_per_hour' => $rate,
            'gross' => $gross,
            'deductions' => 0,
            'net' => $gross,
            'status' => 'ready',
            'week_start' => $start,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    foreach (section($data, 'payroll_deductions') as $weekStart => $workerMap) {
        if ((string) $weekStart !== (string) $start || ! is_array($workerMap)) {
            continue;
        }
        foreach ($workerMap as $workerName => $items) {
            $payroll = DB::table('payrolls')->where('cutoff_id', $cutoffId)->where('worker_name', $workerName)->first();
            if (! $payroll) {
                continue;
            }
            $totalDeduction = 0;
            foreach ($items as $item) {
                $totalDeduction += (float) $item['amount'];
                DB::table('payroll_deductions')->insert([
                    'payroll_id' => $payroll->id,
                    'type' => $item['type'],
                    'amount' => $item['amount'],
                    'note' => $item['note'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            DB::table('payrolls')->where('id', $payroll->id)->update([
                'deductions' => $totalDeduction,
                'net' => round((float) $payroll->gross - $totalDeduction, 2),
                'status' => 'ready',
            ]);
        }
    }
}

// released cutoffs: mark payrolls + the cutoff as paid
foreach (section($data, 'payroll_releases') as $release) {
    $cutoff = DB::table('payroll_cutoffs')
        ->where('start_date', $release['start_date'])
        ->where('end_date', $release['end_date'])
        ->first();
    if (! $cutoff) {
        continue;
    }
    DB::table('payrolls')->where('cutoff_id', $cutoff->id)->update([
        'status' => 'paid',
        'released_at' => $release['released_at'] ?? null,
        'released_by' => $userByEmail[$release['released_by_email']] ?? null,
        'payment_reference' => $release['payment_reference'] ?? null,
        'bank_export_ref' => $release['bank_export_ref'] ?? null,
    ]);
    DB::table('payroll_cutoffs')->where('id', $cutoff->id)->update([
        'status' => 'paid',
        'updated_at' => $release['released_at'] ?? now(),
    ]);
}

// status overrides are applied to the latest payroll week
$latestWeek = collect(section($data, 'payroll_weeks'))->last();
if ($latestWeek) {
    $latestCutoff = DB::table('payroll_cutoffs')
        ->where('start_date', $latestWeek['start_date'])
        ->where('end_date', $latestWeek['end_date'])
        ->first();
    foreach (section($data, 'payroll_status_overrides') as $workerName => $status) {
        DB::table('payrolls')->where('cutoff_id', $latestCutoff->id)->where('worker_name', $workerName)
            ->update(['status' => $status]);
    }
    DB::table('payroll_cutoffs')->where('id', $latestCutoff->id)->update(['status' => 'generated']);
}

// ---------------------------------------------------------------------------
// Foreman submissions: material requests, issues, deliveries, progress photos
// ---------------------------------------------------------------------------
foreach (section($data, 'material_requests') as $row) {
    required($row, 'project');
    DB::table('material_requests')->insert(collect($row)
        ->except(['project', 'foreman'])
        ->merge([
            'project_id' => $projectIdByName[$row['project']],
            'foreman_id' => $userByFullname[$row['foreman']],
        ])
        ->all());
}

foreach (section($data, 'issue_reports') as $row) {
    required($row, 'project');
    DB::table('issue_reports')->insert(collect($row)
        ->except(['project', 'foreman'])
        ->merge([
            'project_id' => $projectIdByName[$row['project']],
            'foreman_id' => $userByFullname[$row['foreman']],
        ])
        ->all());
}

foreach (section($data, 'delivery_confirmations') as $row) {
    required($row, 'project');
    DB::table('delivery_confirmations')->insert(collect($row)
        ->except(['project', 'foreman'])
        ->merge([
            'project_id' => $projectIdByName[$row['project']],
            'foreman_id' => $userByFullname[$row['foreman']],
        ])
        ->all());
}

foreach (section($data, 'progress_photos') as $row) {
    required($row, 'project');
    DB::table('progress_photos')->insert(collect($row)
        ->except(['project', 'foreman'])
        ->merge([
            'project_id' => $projectIdByName[$row['project']],
            'foreman_id' => $userByFullname[$row['foreman']],
        ])
        ->all());
}

// ---------------------------------------------------------------------------
// Project files
// ---------------------------------------------------------------------------
foreach (section($data, 'project_files') as $row) {
    required($row, 'project');
    DB::table('project_files')->insert(collect($row)
        ->except(['project'])
        ->merge([
            'project_id' => $projectIdByName[$row['project']],
            'uploaded_by' => $userByFullname[$row['uploaded_by']] ?? null,
        ])
        ->all());
}

// ---------------------------------------------------------------------------
// Monitoring board: departments, items, item files
// ---------------------------------------------------------------------------
$monitoringItemIdByName = [];

foreach (section($data, 'monitoring_board_departments') as $name) {
    DB::table('monitoring_board_departments')->updateOrInsert(['name' => $name], ['name' => $name]);
}

foreach (section($data, 'monitoring_board_items') as $row) {
    required($row, 'project_name');
    $attrs = collect($row)->except(['files'])->all();
    if (! empty($row['project'])) {
        $attrs['project_id'] = $projectIdByName[$row['project']];
    }
    if (! empty($row['created_by'])) {
        $attrs['created_by'] = $userByFullname[$row['created_by']] ?? null;
    }
    unset($attrs['project']);
    $itemId = DB::table('monitoring_board_items')->insertGetId($attrs);
    $monitoringItemIdByName[$row['project_name']] = $itemId;

    foreach ($row['files'] ?? [] as $file) {
        DB::table('monitoring_board_files')->insert([
            'monitoring_board_item_id' => $itemId,
            'file_path' => $file['file_path'] ?? null,
            'original_name' => $file['original_name'] ?? null,
            'mime_type' => $file['mime_type'] ?? null,
            'uploaded_by' => $attrs['created_by'] ?? null,
            'created_at' => $row['updated_at'] ?? now(),
            'updated_at' => $row['updated_at'] ?? now(),
        ]);
    }
}

out('[load-test-data] Done.');

