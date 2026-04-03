<?php

namespace App\Services;

use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\PayrollDeduction;
use App\Models\Project;
use App\Support\Projects\ProjectFlow;
use App\Models\Expense;
use App\Models\User;
use App\Models\Worker;
use App\Repositories\Contracts\PayrollRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayrollService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly PayrollRepositoryInterface $payrollRepository
    ) {
    }

    public function indexPayload(Request $request): array
    {
        $group = $this->normalizePayrollGroup((string) $request->query('group', 'workers'));
        $selectedProject = $this->resolveSelectedProject($request, $group);
        $selectedProjectId = $selectedProject?->id;

        $payrolls = $this->payrollRepository->latestPayrollsWithUser($group, $selectedProjectId);
        $totalPayable = $this->payrollRepository->totalPayableByStatuses(Payroll::payableStatuses(), $group, $selectedProjectId);
        $workerOptions = $this->manualPayrollWorkerOptions($group, $selectedProjectId);

        return [
            'payrolls' => $payrolls,
            'totalPayable' => $totalPayable,
            'workerOptions' => $workerOptions,
            'payrollGroup' => $group,
            'projectOptions' => $this->projectOptionsPayload($selectedProject, $group),
            'selectedProject' => $selectedProject ? $this->projectPayload($selectedProject) : null,
        ];
    }

    public function store(array $validated, int $authId): void
    {
        $gross = (float) $validated['hours'] * (float) $validated['rate_per_hour'];
        $deductions = (float) ($validated['deductions'] ?? 0);
        $net = $gross - $deductions;

        $projectId = $validated['project_id'] ?? null;
        $projectSnapshot = $this->resolveProjectSnapshot($projectId !== null && $projectId !== '' ? (int) $projectId : null);
        $this->payrollRepository->createPayroll([
            'user_id' => $authId,
            'project_id' => $projectId !== null && $projectId !== '' ? (int) $projectId : null,
            'project_name' => $projectSnapshot['name'],
            'project_client' => $projectSnapshot['client'],
            'worker_name' => $validated['worker_name'],
            'role' => $validated['role'],
            'hours' => $validated['hours'],
            'rate_per_hour' => $validated['rate_per_hour'],
            'gross' => $gross,
            'deductions' => $deductions,
            'net' => $net,
            'week_start' => $validated['week_start'],
        ]);

        $this->syncWorkerDefaultRate((string) $validated['worker_name'], (float) $validated['rate_per_hour']);
    }

    public function updateStatus(Payroll $payroll, string $status): void
    {
        $this->payrollRepository->updatePayroll($payroll, [
            'status' => $status,
        ]);
    }

    public function updatePayroll(Payroll $payroll, array $validated): void
    {
        $gross = round((float) $validated['hours'] * (float) $validated['rate_per_hour'], 2);
        $deductions = round((float) ($validated['deductions'] ?? 0), 2);
        $net = round($gross - $deductions, 2);

        $projectId = $validated['project_id'] ?? null;
        $projectSnapshot = $this->resolveProjectSnapshot($projectId !== null && $projectId !== '' ? (int) $projectId : null);
        $this->payrollRepository->updatePayroll($payroll, [
            'project_id' => $projectId !== null && $projectId !== '' ? (int) $projectId : null,
            'project_name' => $projectSnapshot['name'],
            'project_client' => $projectSnapshot['client'],
            'worker_name' => $validated['worker_name'],
            'role' => $validated['role'],
            'week_start' => $validated['week_start'],
            'hours' => $validated['hours'],
            'rate_per_hour' => $validated['rate_per_hour'],
            'gross' => $gross,
            'deductions' => $deductions,
            'net' => $net,
            'status' => $validated['status'],
        ]);

        $this->syncWorkerDefaultRate((string) $validated['worker_name'], (float) $validated['rate_per_hour']);
    }

    public function updatePayrollHours(Payroll $payroll, float $hours): void
    {
        if ($payroll->status === Payroll::STATUS_PAID) {
            throw ValidationException::withMessages([
                'payroll' => 'Paid payroll rows cannot be edited.',
            ]);
        }

        $gross = round($hours * (float) $payroll->rate_per_hour, 2);
        $deductions = round($this->payrollRepository->sumDeductionAmount($payroll), 2);
        $incentives = round($this->payrollRepository->sumIncentiveAmount($payroll), 2);
        $net = round($gross - $deductions + $incentives, 2);

        $this->payrollRepository->updatePayroll($payroll, [
            'hours' => $hours,
            'gross' => $gross,
            'deductions' => $deductions,
            'net' => $net,
        ]);
    }

    public function runPayload(Request $request): array
    {
        [$search, $perPage] = $this->runTableParams($request);
        $group = $this->normalizePayrollGroup((string) $request->query('group', 'workers'));
        $selectedProject = $this->resolveSelectedProject($request, $group);
        $selectedProjectId = $selectedProject?->id;

        $selectedCutoff = $this->resolveSelectedCutoff($request, $group, $selectedProjectId);
        $payrollPaginator = $this->payrollRepository->runPayrollPaginator(
            $selectedCutoff?->id,
            $search,
            $perPage,
            $group,
            $selectedProjectId
        );

        $payrollRows = collect($payrollPaginator->items())
            ->map(fn (Payroll $payroll) => $this->payrollRowPayload($payroll))
            ->values();

        return [
            'projectOptions' => $this->projectOptionsPayload($selectedProject, $group),
            'selectedProject' => $selectedProject ? $this->projectPayload($selectedProject) : null,
            'cutoffs' => $this->cutoffOptions($group, $selectedProjectId),
            'selectedCutoff' => $selectedCutoff ? $this->cutoffPayload($selectedCutoff, $group, $selectedProjectId) : null,
            'payrollRows' => $payrollRows,
            'projectFinancialSummary' => $selectedProject
                ? $this->projectFinancialSummaryPayload($selectedProject, $group, $selectedCutoff)
                : null,
            'generateProjectOptions' => $this->generateProjectOptionsPayload($selectedProject, $group),
            'payrollHistory' => $this->payrollHistoryPayload($group),
            'projectPayrollHistory' => $this->payrollHistoryPayload($group),
            'payrollGroup' => $group,
            'payrollTable' => [
                'search' => $search,
                'project_id' => $selectedProjectId,
                'per_page' => $payrollPaginator->perPage(),
                'current_page' => $payrollPaginator->currentPage(),
                'last_page' => max(1, $payrollPaginator->lastPage()),
                'total' => $payrollPaginator->total(),
                'from' => $payrollPaginator->firstItem(),
                'to' => $payrollPaginator->lastItem(),
            ],
            'today' => now()->toDateString(),
        ];
    }

    public function workerRatesPayload(Request $request): array
    {
        [$search, $perPage] = $this->runTableParams($request);
        $needle = mb_strtolower($search);
        $group = $this->normalizePayrollGroup((string) $request->query('group', 'workers'));
        $projectId = (int) $request->query('project_id', 0) ?: null;

        if ($group === 'staff') {
            $staffRows = $this->payrollRepository->staffUsersForRates()
                ->map(function (User $user) use ($needle) {
                    $role = trim((string) ($user->role ?? ''));
                    $personType = $role !== '' ? strtoupper($role) : 'Staff';
                    $row = [
                        'id' => $user->id,
                        'entity_type' => 'staff',
                        'name' => $user->fullname,
                        'person_type' => $personType,
                        'foreman_name' => null,
                        'phone' => null,
                        'sex' => null,
                        'email' => $user->email,
                        'default_rate_per_hour' => $user->default_rate_per_hour !== null ? (float) $user->default_rate_per_hour : null,
                        'updated_at' => optional($user->updated_at)?->toDateTimeString(),
                    ];

                    if ($needle === '') {
                        return $row;
                    }

                    $haystack = mb_strtolower(implode(' | ', [
                        $row['name'] ?? '',
                        $row['person_type'] ?? '',
                        $row['email'] ?? '',
                    ]));

                    return str_contains($haystack, $needle) ? $row : null;
                })
                ->filter()
                ->values();

            $currentPage = max(1, (int) $request->query('page', 1));
            $total = $staffRows->count();
            $items = $staffRows->forPage($currentPage, $perPage)->values();

            $paginator = new LengthAwarePaginator(
                $items,
                $total,
                $perPage,
                $currentPage,
                [
                    'path' => $request->url(),
                    'query' => $request->query(),
                ]
            );

            return [
                'workerRates' => $items,
                'workerRateTable' => [
                    'search' => $search,
                    'project_id' => $projectId,
                    'per_page' => $paginator->perPage(),
                    'current_page' => $paginator->currentPage(),
                    'last_page' => max(1, $paginator->lastPage()),
                    'total' => $paginator->total(),
                    'from' => $paginator->firstItem(),
                    'to' => $paginator->lastItem(),
                ],
                'rateGroup' => $group,
            ];
        }

        $workerRows = $this->payrollRepository->workersWithForeman()
            ->map(function (Worker $worker) use ($needle) {
                $row = [
                    'id' => $worker->id,
                    'entity_type' => 'worker',
                    'name' => $worker->name,
                    'person_type' => 'Worker',
                    'foreman_name' => $worker->foreman?->fullname,
                    'phone' => $worker->phone,
                    'sex' => $worker->sex,
                    'default_rate_per_hour' => $worker->default_rate_per_hour !== null ? (float) $worker->default_rate_per_hour : null,
                    'updated_at' => optional($worker->updated_at)?->toDateTimeString(),
                ];

                if ($needle === '') {
                    return $row;
                }

                $haystack = mb_strtolower(implode(' | ', [
                    $row['name'] ?? '',
                    $row['person_type'] ?? '',
                    $row['foreman_name'] ?? '',
                    $row['phone'] ?? '',
                    $row['sex'] ?? '',
                ]));

                return str_contains($haystack, $needle) ? $row : null;
            })
            ->filter()
            ->values();

        $foremanRows = $this->payrollRepository->foremenForRates()
            ->map(function (User $foreman) use ($needle) {
                $row = [
                    'id' => $foreman->id,
                    'entity_type' => User::ROLE_FOREMAN,
                    'name' => $foreman->fullname,
                    'person_type' => 'Foreman',
                    'foreman_name' => null,
                    'phone' => null,
                    'sex' => null,
                    'email' => $foreman->email,
                    'default_rate_per_hour' => $foreman->default_rate_per_hour !== null ? (float) $foreman->default_rate_per_hour : null,
                    'updated_at' => optional($foreman->updated_at)?->toDateTimeString(),
                ];

                if ($needle === '') {
                    return $row;
                }

                $haystack = mb_strtolower(implode(' | ', [
                    $row['name'] ?? '',
                    $row['person_type'] ?? '',
                    $row['email'] ?? '',
                ]));

                return str_contains($haystack, $needle) ? $row : null;
            })
            ->filter()
            ->values();

        $allRows = $workerRows
            ->concat($foremanRows)
            ->sortBy(fn ($row) => sprintf('%s|%s', (string) ($row['person_type'] ?? ''), (string) ($row['name'] ?? '')), SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        $currentPage = max(1, (int) $request->query('page', 1));
        $total = $allRows->count();
        $items = $allRows->forPage($currentPage, $perPage)->values();

        $paginator = new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $currentPage,
            [
                'path' => $request->url(),
                'query' => $request->query(),
            ]
        );

        return [
            'workerRates' => $items,
            'workerRateTable' => [
                'search' => $search,
                'project_id' => $projectId,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'rateGroup' => $group,
        ];
    }

    public function updateWorkerRate(Worker $worker, float $rate): void
    {
        $this->payrollRepository->updateWorkerDefaultRate($worker, $rate);
    }

    public function updateForemanRate(User $user, float $rate): void
    {
        abort_unless($user->role === User::ROLE_FOREMAN, 404);

        $this->payrollRepository->updateForemanDefaultRate($user, $rate);
    }

    public function updateStaffRate(User $user, float $rate): void
    {
        abort_unless(in_array($user->role, [User::ROLE_HR, User::ROLE_ADMIN, User::ROLE_DESIGNER], true), 404);

        $user->update([
            'default_rate_per_hour' => round($rate, 2),
        ]);
    }

    public function generateFromAttendance(array $validated, int $authId, ?string $group = null): PayrollCutoff
    {
        $startDate = $validated['start_date'];
        $endDate = $validated['end_date'];
        $projectId = (int) ($validated['project_id'] ?? 0);
        $normalizedGroup = $this->normalizePayrollGroup((string) $group);
        if ($normalizedGroup !== 'staff' && $projectId <= 0) {
            throw ValidationException::withMessages([
                'project_id' => 'Please select a project.',
            ]);
        }
        if ($normalizedGroup === 'staff') {
            $projectId = null;
        }

        $attendanceSummary = $this->payrollRepository->attendanceSummaryBetween($startDate, $endDate, $normalizedGroup, $projectId);

        $attendanceSummary = collect($attendanceSummary);
        $summaryByName = $attendanceSummary
            ->mapWithKeys(function ($row) {
                $name = Str::lower(trim((string) ($row->worker_name ?? '')));
                return $name !== '' ? [$name => true] : [];
            });

        if ($normalizedGroup === 'staff') {
            $days = max(1, Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)) + 1);
            $defaultHours = $days * 8;
            $staffUsers = $this->payrollRepository->staffUsersForRates();

            $extras = $staffUsers
                ->map(function (User $user) use ($defaultHours, $summaryByName) {
                    $name = trim((string) ($user->fullname ?? ''));
                    if ($name === '') {
                        return null;
                    }

                    $key = Str::lower($name);
                    if ($summaryByName->has($key)) {
                        return null;
                    }

                    return (object) [
                        'worker_name' => $name,
                        'worker_role' => $this->formatStaffRoleLabel($user->role),
                        'total_hours' => $defaultHours,
                    ];
                })
                ->filter()
                ->values();

            $attendanceSummary = $attendanceSummary->concat($extras)->values();
        }

        if ($normalizedGroup === 'workers') {
            $extras = collect();

            foreach ($this->payrollRepository->workersWithForeman($projectId) as $worker) {
                $name = trim((string) ($worker->name ?? ''));
                if ($name === '') {
                    continue;
                }

                $key = Str::lower($name);
                if ($summaryByName->has($key)) {
                    continue;
                }

                $role = trim((string) ($worker->job_type ?? Worker::JOB_TYPE_WORKER));
                $role = $role !== '' ? $role : Worker::JOB_TYPE_WORKER;

                $extras->push((object) [
                    'worker_name' => $name,
                    'worker_role' => $role,
                    'total_hours' => 0,
                ]);
                $summaryByName->put($key, true);
            }

            foreach ($this->payrollRepository->foremenForProject($projectId) as $foreman) {
                $name = trim((string) ($foreman->fullname ?? ''));
                if ($name === '') {
                    continue;
                }

                $key = Str::lower($name);
                if ($summaryByName->has($key)) {
                    continue;
                }

                $extras->push((object) [
                    'worker_name' => $name,
                    'worker_role' => 'Foreman',
                    'total_hours' => 0,
                ]);
                $summaryByName->put($key, true);
            }

            $attendanceSummary = $attendanceSummary->concat($extras)->values();
        }

        if ($attendanceSummary->isEmpty()) {
            throw ValidationException::withMessages([
                'start_date' => __('messages.payroll.no_attendance_for_cutoff'),
            ]);
        }

        $existingCutoff = $this->payrollRepository->findCutoffByRange($startDate, $endDate);

        if ($existingCutoff) {
            $aggregates = $this->payrollRepository->payrollAggregatesByCutoffId((int) $existingCutoff->id, $normalizedGroup, $projectId);
            $paidCount = $this->payrollRepository->paidPayrollCountByCutoffId((int) $existingCutoff->id, $normalizedGroup, $projectId);
            $payrollCount = (int) ($aggregates['payroll_count'] ?? 0);

            if ($payrollCount > 0 && $paidCount >= $payrollCount) {
                throw ValidationException::withMessages([
                    'start_date' => __('messages.payroll.cutoff_already_paid'),
                ]);
            }
        }

        return DB::transaction(function () use ($startDate, $endDate, $attendanceSummary, $authId, $normalizedGroup, $projectId) {
            $cutoff = $this->payrollRepository->firstOrCreateCutoff($startDate, $endDate);
            $this->payrollRepository->deletePayrollsByCutoffId((int) $cutoff->id, $normalizedGroup, $projectId);
            $projectSnapshot = $this->resolveProjectSnapshot($projectId);

            foreach ($attendanceSummary as $row) {
                $hours = round((float) ($row->total_hours ?? 0), 2);
                $rate = $this->resolveRateForWorker((string) $row->worker_name, $row->worker_role ? (string) $row->worker_role : null);
                $gross = round($hours * $rate, 2);

                $this->payrollRepository->createPayroll([
                    'user_id' => $authId,
                    'cutoff_id' => $cutoff->id,
                    'project_id' => $projectId,
                    'project_name' => $projectSnapshot['name'],
                    'project_client' => $projectSnapshot['client'],
                    'worker_name' => $row->worker_name,
                    'role' => $row->worker_role ?: 'Labor',
                    'hours' => $hours,
                    'rate_per_hour' => $rate,
                    'gross' => $gross,
                    'deductions' => 0,
                    'net' => $gross,
                    'status' => Payroll::STATUS_READY,
                    'week_start' => $startDate,
                ]);
            }

            $cutoff->update(['status' => PayrollCutoff::STATUS_GENERATED]);

            return $cutoff;
        });
    }

    public function addDeduction(Payroll $payroll, array $validated): void
    {
        $this->assertPayrollEditable($payroll);

        $this->payrollRepository->createDeduction($payroll, $validated);
        $this->syncPayrollFinancials($payroll);
    }

    public function updateDeduction(PayrollDeduction $payrollDeduction, array $validated): Payroll
    {
        $payroll = $this->payrollRepository->loadPayrollFromDeduction($payrollDeduction);
        $this->assertPayrollEditable($payroll);

        $this->payrollRepository->updateDeduction($payrollDeduction, $validated);
        $this->syncPayrollFinancials($payroll);

        return $payroll;
    }

    public function destroyDeduction(PayrollDeduction $payrollDeduction): Payroll
    {
        $payroll = $this->payrollRepository->loadPayrollFromDeduction($payrollDeduction);
        $this->assertPayrollEditable($payroll);

        $this->payrollRepository->deleteDeduction($payrollDeduction);
        $this->syncPayrollFinancials($payroll);

        return $payroll;
    }

    public function markPaid(array $validated, int $authId, ?string $group = null, ?int $projectId = null): PayrollCutoff
    {
        $cutoff = $this->payrollRepository->findCutoffById((int) $validated['cutoff_id']);
        abort_unless($cutoff instanceof PayrollCutoff, 404);

        $normalizedGroup = $this->normalizePayrollGroup((string) $group);
        $payrolls = $this->payrollRepository->payrollsByCutoffId((int) $cutoff->id, $normalizedGroup, $projectId);

        if ($payrolls->isEmpty()) {
            throw ValidationException::withMessages([
                'cutoff_id' => __('messages.payroll.no_rows_for_cutoff'),
            ]);
        }

        $now = now();

        DB::transaction(function () use ($payrolls, $cutoff, $validated, $now, $authId) {
            foreach ($payrolls as $payroll) {
                $this->syncPayrollFinancials($payroll);
                $this->payrollRepository->updatePayroll($payroll, [
                    'status' => Payroll::STATUS_PAID,
                    'released_at' => $now,
                    'released_by' => $authId,
                    'payment_reference' => $validated['payment_reference'] ?? null,
                    'bank_export_ref' => $validated['bank_export_ref'] ?? null,
                ]);
            }

            $hasUnpaid = Payroll::query()
                ->where('cutoff_id', $cutoff->id)
                ->where('status', '!=', Payroll::STATUS_PAID)
                ->exists();

            if (!$hasUnpaid) {
                $cutoff->update(['status' => PayrollCutoff::STATUS_PAID]);
            }
        });

        return $cutoff;
    }

    public function exportResponse(int $cutoffId, ?string $group = null, ?int $projectId = null): StreamedResponse
    {
        $cutoff = $this->payrollRepository->findCutoffById($cutoffId);
        abort_unless($cutoff instanceof PayrollCutoff, 404);

        $normalizedGroup = $this->normalizePayrollGroup((string) $group);
        $payrolls = $this->payrollRepository->payrollsForExportByCutoffId((int) $cutoff->id, $normalizedGroup, $projectId);

        $filename = sprintf(
            'payroll-cutoff-%s-to-%s.csv',
            optional($cutoff->start_date)->toDateString(),
            optional($cutoff->end_date)->toDateString()
        );

        return response()->streamDownload(function () use ($payrolls, $cutoff) {
            $out = fopen('php://output', 'w');

            $formatCsvDate = function ($value) {
                if (!$value) {
                    return '';
                }
                return '="' . $value . '"';
            };

            fputcsv($out, ['Cutoff Start', $formatCsvDate(optional($cutoff->start_date)->toDateString())]);
            fputcsv($out, ['Cutoff End', $formatCsvDate(optional($cutoff->end_date)->toDateString())]);
            fputcsv($out, ['Status', $cutoff->status]);
            fputcsv($out, []);
            fputcsv($out, [
                'Project',
                'Worker Name',
                'Role',
                'Hours',
                'Rate Per Hour',
                'Gross',
                'Incentives',
                'Deductions',
                'Net Pay',
                'Status',
                'Released At',
                'Payment Reference',
                'Bank Export Ref',
            ]);

            foreach ($payrolls as $payroll) {
                $deductionTotal = round((float) $payroll->deductionItems
                    ->where('type', '!=', PayrollDeduction::TYPE_INCENTIVE)
                    ->sum('amount'), 2);
                $incentiveTotal = round((float) $payroll->deductionItems
                    ->where('type', PayrollDeduction::TYPE_INCENTIVE)
                    ->sum('amount'), 2);
                fputcsv($out, [
                    $payroll->project?->name ?: ($payroll->project_name ?: '-'),
                    $payroll->worker_name,
                    $payroll->role,
                    (float) $payroll->hours,
                    (float) $payroll->rate_per_hour,
                    (float) $payroll->gross,
                    $incentiveTotal,
                    $deductionTotal,
                    (float) $payroll->net,
                    $payroll->status,
                    $formatCsvDate(optional($payroll->released_at)?->toDateTimeString()),
                    $payroll->payment_reference,
                    $payroll->bank_export_ref,
                ]);
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function payrollRunQueryParams(Request $request, Payroll $payroll): array
    {
        return array_filter([
            'cutoff_id' => $request->query('cutoff_id', $payroll->cutoff_id),
            'project_id' => $request->query('project_id', $payroll->project_id),
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
            'group' => $request->query('group'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    public function markPaidQueryParams(Request $request, PayrollCutoff $cutoff): array
    {
        return array_filter([
            'cutoff_id' => $cutoff->id,
            'project_id' => $request->query('project_id'),
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
            'group' => $request->query('group'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    public function runGenerateQueryParams(Request $request, PayrollCutoff $cutoff): array
    {
        return array_filter([
            'cutoff_id' => $cutoff->id,
            'project_id' => $request->query('project_id', $request->input('project_id')),
            'per_page' => $request->query('per_page', 10),
            'group' => $request->query('group', 'workers'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    public function tableQueryParams(Request $request): array
    {
        return array_filter([
            'project_id' => $request->query('project_id'),
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
            'group' => $request->query('group'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function runTableParams(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);

        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        return [$search, $perPage];
    }

    private function normalizePayrollGroup(?string $group): string
    {
        $normalized = strtolower(trim((string) $group));
        if (!in_array($normalized, ['workers', 'staff'], true)) {
            return 'workers';
        }

        return $normalized;
    }

    private function resolveSelectedCutoff(Request $request, string $group, ?int $projectId = null): ?PayrollCutoff
    {
        $cutoffId = (int) $request->query('cutoff_id', 0);

        if ($cutoffId > 0) {
            $found = $this->payrollRepository->findCutoffById($cutoffId);
            if ($found && $this->hasCutoffRowsForGroup($found, $group, $projectId)) {
                return $found;
            }
        }

        return $this->latestCutoffForGroup($group, $projectId);
    }

    private function cutoffOptions(string $group, ?int $projectId = null): Collection
    {
        return $this->payrollRepository
            ->cutoffOptionsRows($group, $projectId)
            ->map(fn (PayrollCutoff $cutoff) => $this->cutoffPayload($cutoff, $group, $projectId))
            ->filter(fn (array $payload) => (int) ($payload['payroll_count'] ?? 0) > 0)
            ->values();
    }

    private function cutoffPayload(PayrollCutoff $cutoff, string $group, ?int $projectId = null): array
    {
        $aggregates = $this->payrollRepository->payrollAggregatesByCutoffId((int) $cutoff->id, $group, $projectId);
        $payrollCount = (int) $aggregates['payroll_count'];
        $paidCount = $this->payrollRepository->paidPayrollCountByCutoffId((int) $cutoff->id, $group, $projectId);
        $groupStatus = $payrollCount > 0 && $paidCount >= $payrollCount
            ? PayrollCutoff::STATUS_PAID
            : PayrollCutoff::STATUS_GENERATED;

        return [
            'id' => $cutoff->id,
            'start_date' => optional($cutoff->start_date)?->toDateString(),
            'end_date' => optional($cutoff->end_date)?->toDateString(),
            'status' => $groupStatus,
            'payroll_count' => $payrollCount,
            'total_hours' => round((float) $aggregates['total_hours'], 2),
            'total_gross' => round((float) $aggregates['total_gross'], 2),
            'total_deductions' => round((float) $aggregates['total_deductions'], 2),
            'total_net' => round((float) $aggregates['total_net'], 2),
            'paid_count' => $paidCount,
        ];
    }

    private function payrollRowPayload(Payroll $payroll): array
    {
        $payroll->loadMissing(['deductionItems', 'releasedBy:id,fullname', 'project:id,name,client,status,phase,contract_amount']);

        $deductionItems = $payroll->deductionItems
            ->map(fn (PayrollDeduction $deduction) => [
                'id' => $deduction->id,
                'type' => $deduction->type,
                'amount' => (float) $deduction->amount,
                'note' => $deduction->note,
            ])
            ->values();

        return [
            'id' => $payroll->id,
            'cutoff_id' => $payroll->cutoff_id,
            'project_id' => $payroll->project_id !== null ? (int) $payroll->project_id : null,
            'project_name' => $payroll->project?->name ?? $payroll->project_name,
            'project_client' => $payroll->project?->client ?? $payroll->project_client,
            'worker_name' => $payroll->worker_name,
            'role' => $payroll->role,
            'hours' => (float) $payroll->hours,
            'rate_per_hour' => (float) $payroll->rate_per_hour,
            'gross' => (float) $payroll->gross,
            'deductions' => (float) $payroll->deductions,
            'net' => (float) $payroll->net,
            'status' => $payroll->status,
            'week_start' => optional($payroll->week_start)?->toDateString(),
            'released_at' => optional($payroll->released_at)?->toDateTimeString(),
            'released_by_name' => $payroll->releasedBy?->fullname,
            'payment_reference' => $payroll->payment_reference,
            'bank_export_ref' => $payroll->bank_export_ref,
            'can_edit_deductions' => $payroll->status !== Payroll::STATUS_PAID,
            'deduction_items' => $deductionItems,
        ];
    }

    private function syncPayrollFinancials(Payroll $payroll): void
    {
        $payroll->refresh();
        $gross = round((float) $payroll->hours * (float) $payroll->rate_per_hour, 2);
        $deductions = round($this->payrollRepository->sumDeductionAmount($payroll), 2);
        $incentives = round($this->payrollRepository->sumIncentiveAmount($payroll), 2);
        $net = round($gross - $deductions + $incentives, 2);

        $this->payrollRepository->updatePayroll($payroll, [
            'gross' => $gross,
            'deductions' => $deductions,
            'net' => $net,
        ]);
    }

    private function resolveRateForWorker(string $workerName, ?string $role): float
    {
        $normalizedName = trim($workerName);
        if ($normalizedName === '') {
            return 0.0;
        }

        $workerRate = $this->payrollRepository->workerDefaultRateByName($normalizedName);
        if ($workerRate !== null) {
            return round($workerRate, 2);
        }

        $foremanRate = $this->payrollRepository->foremanDefaultRateByName($normalizedName);
        if ($foremanRate !== null) {
            return round($foremanRate, 2);
        }

        $staffRate = $this->payrollRepository->staffDefaultRateByName($normalizedName);
        if ($staffRate !== null) {
            return round($staffRate, 2);
        }

        $exactRate = $this->payrollRepository->latestPayrollRateByName($normalizedName);
        if ($exactRate !== null) {
            return round($exactRate, 2);
        }

        if ($role) {
            $roleRate = $this->payrollRepository->latestPayrollRateByRole($role);
            if ($roleRate !== null) {
                return round($roleRate, 2);
            }
        }

        return 0.0;
    }

    private function assertPayrollEditable(Payroll $payroll): void
    {
        if ($payroll->status === Payroll::STATUS_PAID || $payroll->cutoff?->status === PayrollCutoff::STATUS_PAID) {
            throw ValidationException::withMessages([
                'payroll' => __('messages.payroll.paid_rows_locked'),
            ]);
        }
    }

    private function manualPayrollWorkerOptions(string $group, ?int $projectId = null): Collection
    {
        if ($group === 'staff') {
            $options = [];

            $latestPayrollWorkers = $this->payrollRepository->latestPayrollWorkers($projectId);
            foreach ($latestPayrollWorkers as $payroll) {
                $role = (string) ($payroll->role ?? '');
                if (!$this->isStaffRoleLabel($role)) {
                    continue;
                }

                $name = trim((string) $payroll->worker_name);
                if ($name === '') {
                    continue;
                }

                $key = mb_strtolower($name);
                if (!isset($options[$key])) {
                    $options[$key] = [
                        'value' => $name,
                        'label' => $name,
                        'name' => $name,
                        'default_rate_per_hour' => (float) ($payroll->rate_per_hour ?? 0),
                        'role' => $payroll->role ?: null,
                    ];
                }
            }

            $staffUsers = $this->payrollRepository->staffUsersForRates();
            foreach ($staffUsers as $user) {
                $name = trim((string) $user->fullname);
                if ($name === '') {
                    continue;
                }

                $key = mb_strtolower($name);
                if (!isset($options[$key])) {
                    $options[$key] = [
                        'value' => $name,
                        'label' => $name,
                        'name' => $name,
                        'default_rate_per_hour' => null,
                        'role' => $user->role ?: null,
                    ];
                }

                if ($user->default_rate_per_hour !== null && (float) $user->default_rate_per_hour > 0) {
                    $options[$key]['default_rate_per_hour'] = (float) $user->default_rate_per_hour;
                }
            }

            return collect(array_values($options))
                ->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)
                ->values();
        }

        $options = [];

        $latestPayrollWorkers = $this->payrollRepository->latestPayrollWorkers($projectId);
        foreach ($latestPayrollWorkers as $payroll) {
            if ($this->isStaffRoleLabel((string) ($payroll->role ?? ''))) {
                continue;
            }
            $name = trim((string) $payroll->worker_name);
            if ($name === '') {
                continue;
            }

            $key = mb_strtolower($name);
            if (!isset($options[$key])) {
                $options[$key] = [
                    'value' => $name,
                    'label' => $name,
                    'name' => $name,
                    'default_rate_per_hour' => (float) ($payroll->rate_per_hour ?? 0),
                    'role' => $payroll->role ?: null,
                ];
            }
        }

        $workers = $projectId !== null
            ? $this->payrollRepository->workersWithForeman($projectId)->map(function (Worker $worker) {
                return (object) [
                    'name' => $worker->name,
                    'default_rate_per_hour' => $worker->default_rate_per_hour,
                ];
            })
            : $this->payrollRepository->workersForOptions();
        foreach ($workers as $worker) {
            $name = trim((string) $worker->name);
            if ($name === '') {
                continue;
            }

            $key = mb_strtolower($name);
            if (!isset($options[$key])) {
                $options[$key] = [
                    'value' => $name,
                    'label' => $name,
                    'name' => $name,
                    'default_rate_per_hour' => null,
                    'role' => null,
                ];
            }

            if ($worker->default_rate_per_hour !== null && (float) $worker->default_rate_per_hour > 0) {
                $options[$key]['default_rate_per_hour'] = (float) $worker->default_rate_per_hour;
            }
        }

        $foremen = $projectId !== null
            ? $this->payrollRepository->foremenForProject($projectId)
            : $this->payrollRepository->foremenForOptions();
        foreach ($foremen as $foreman) {
            $name = trim((string) $foreman->fullname);
            if ($name === '') {
                continue;
            }

            $key = mb_strtolower($name);
            if (!isset($options[$key])) {
                $options[$key] = [
                    'value' => $name,
                    'label' => $name,
                    'name' => $name,
                    'default_rate_per_hour' => null,
                    'role' => 'Foreman',
                ];
            } elseif (empty($options[$key]['role'])) {
                $options[$key]['role'] = 'Foreman';
            }

            if ($foreman->default_rate_per_hour !== null && (float) $foreman->default_rate_per_hour > 0) {
                $options[$key]['default_rate_per_hour'] = (float) $foreman->default_rate_per_hour;
            }
        }

        return collect(array_values($options))
            ->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
    }

    private function isStaffRoleLabel(?string $role): bool
    {
        $normalized = strtolower(trim((string) $role));
        if ($normalized === '') {
            return false;
        }

        if (str_contains($normalized, 'head') && str_contains($normalized, 'admin')) {
            return false;
        }

        $matchers = ['hr', 'human resources', 'admin', 'administrator', 'designer'];
        foreach ($matchers as $matcher) {
            if ($normalized === $matcher || str_contains($normalized, $matcher)) {
                return true;
            }
        }

        return false;
    }

    private function formatStaffRoleLabel(?string $role): string
    {
        $normalized = strtolower(trim((string) $role));
        return match ($normalized) {
            'hr' => 'HR',
            'admin' => 'Admin',
            'designer' => 'Designer',
            default => 'Staff',
        };
    }

    private function hasCutoffRowsForGroup(PayrollCutoff $cutoff, string $group, ?int $projectId = null): bool
    {
        $aggregates = $this->payrollRepository->payrollAggregatesByCutoffId((int) $cutoff->id, $group, $projectId);
        return (int) ($aggregates['payroll_count'] ?? 0) > 0;
    }

    private function latestCutoffForGroup(string $group, ?int $projectId = null): ?PayrollCutoff
    {
        $candidates = $this->payrollRepository->cutoffOptionsRows($group, $projectId);
        foreach ($candidates as $cutoff) {
            if ($this->hasCutoffRowsForGroup($cutoff, $group, $projectId)) {
                return $cutoff;
            }
        }

        return null;
    }

    private function resolveSelectedProject(Request $request, string $group): ?Project
    {
        if ($this->normalizePayrollGroup($group) === 'staff') {
            return null;
        }
        $requestedProjectId = (int) $request->query('project_id', 0);
        if ($requestedProjectId > 0) {
            $requested = $this->payrollRepository->projectById($requestedProjectId);
            if ($requested instanceof Project) {
                return $requested;
            }
        }

        $latestTaggedProjectId = (int) (Payroll::query()
            ->whereNotNull('project_id')
            ->orderByDesc('id')
            ->value('project_id') ?? 0);
        if ($latestTaggedProjectId > 0) {
            $latestTaggedProject = $this->payrollRepository->projectById($latestTaggedProjectId);
            if ($latestTaggedProject instanceof Project) {
                return $latestTaggedProject;
            }
        }

        return $this->payrollRepository->projectOptionsRows()->first();
    }

    private function projectOptionsPayload(?Project $selectedProject = null, ?string $group = null): Collection
    {
        if ($this->normalizePayrollGroup((string) $group) === 'staff') {
            return collect();
        }
        $options = $this->payrollRepository->projectOptionsRows()->values();
        $selectedId = $selectedProject?->id;

        if ($selectedProject && !$options->contains(fn (Project $project) => (int) $project->id === (int) $selectedId)) {
            $options = $options->prepend($selectedProject);
        }

        return $options->map(fn (Project $project) => $this->projectPayload($project))->values();
    }

    private function generateProjectOptionsPayload(?Project $selectedProject = null, ?string $group = null): Collection
    {
        if ($this->normalizePayrollGroup((string) $group) === 'staff') {
            return collect();
        }

        $phaseKey = ProjectFlow::phaseMatchKey(Project::PHASE_CONSTRUCTION);
        $phaseExpr = "LOWER(REPLACE(REPLACE(REPLACE(COALESCE(phase, ''), '-', ''), ' ', ''), '_', ''))";
        $statusExpr = "LOWER(REPLACE(REPLACE(REPLACE(COALESCE(status, ''), '-', ''), ' ', ''), '_', ''))";
        $statusExclusions = ['completed', 'complete', 'done', 'cancelled', 'canceled'];

        return Project::query()
            ->whereRaw("{$phaseExpr} = ?", [$phaseKey])
            ->whereRaw("{$statusExpr} not in (?, ?, ?, ?, ?)", $statusExclusions)
            ->orderBy('name')
            ->get(['id', 'name', 'client', 'phase', 'status', 'contract_amount'])
            ->map(fn (Project $project) => $this->projectPayload($project))
            ->values();
    }

    private function projectPayload(Project $project): array
    {
        return [
            'id' => (int) $project->id,
            'name' => (string) $project->name,
            'client' => (string) ($project->client ?? ''),
            'phase' => (string) ($project->phase ?? ''),
            'status' => (string) ($project->status ?? ''),
            'contract_amount' => (float) ($project->contract_amount ?? 0),
        ];
    }

    private function resolveProjectSnapshot(?int $projectId): array
    {
        if (!$projectId || $projectId <= 0) {
            return ['name' => null, 'client' => null];
        }

        $project = $this->payrollRepository->projectById($projectId);
        if (!$project instanceof Project) {
            return ['name' => null, 'client' => null];
        }

        return [
            'name' => (string) ($project->name ?? ''),
            'client' => (string) ($project->client ?? ''),
        ];
    }

    private function projectFinancialSummaryPayload(Project $project, string $group, ?PayrollCutoff $selectedCutoff = null): array
    {
        $projectId = (int) $project->id;
        $contractAmount = round((float) ($project->contract_amount ?? 0), 2);
        $projectPayrollQuery = Payroll::query()->where('project_id', $projectId);
        $this->applyGroupFilterToPayrollQuery($projectPayrollQuery, $group);

        $totalPayrollNet = round((float) (clone $projectPayrollQuery)->sum('net'), 2);
        $totalPayrollGross = round((float) (clone $projectPayrollQuery)->sum('gross'), 2);
        $totalPayrollDeductions = round((float) (clone $projectPayrollQuery)->sum('deductions'), 2);
        $payrollRowsCount = (int) (clone $projectPayrollQuery)->count();
        $paidRowsCount = (int) (clone $projectPayrollQuery)->where('status', Payroll::STATUS_PAID)->count();

        $totalExpenses = round((float) Expense::query()
            ->where('project_id', $projectId)
            ->sum('amount'), 2);

        $trackedTotalCost = round($totalPayrollNet + $totalExpenses, 2);
        $remainingBudget = round($contractAmount - $trackedTotalCost, 2);
        $utilizationPercent = $contractAmount > 0
            ? round(($trackedTotalCost / $contractAmount) * 100, 2)
            : 0.0;

        $cutoffTotals = [
            'cutoff_id' => null,
            'row_count' => 0,
            'hours' => 0.0,
            'gross' => 0.0,
            'deductions' => 0.0,
            'net' => 0.0,
        ];

        if ($selectedCutoff) {
            $cutoffQuery = Payroll::query()
                ->where('project_id', $projectId)
                ->where('cutoff_id', (int) $selectedCutoff->id);
            $this->applyGroupFilterToPayrollQuery($cutoffQuery, $group);

            $cutoffTotals = [
                'cutoff_id' => (int) $selectedCutoff->id,
                'row_count' => (int) (clone $cutoffQuery)->count(),
                'hours' => round((float) (clone $cutoffQuery)->sum('hours'), 2),
                'gross' => round((float) (clone $cutoffQuery)->sum('gross'), 2),
                'deductions' => round((float) (clone $cutoffQuery)->sum('deductions'), 2),
                'net' => round((float) (clone $cutoffQuery)->sum('net'), 2),
            ];
        }

        return [
            'project' => $this->projectPayload($project),
            'totals' => [
                'contract_amount' => $contractAmount,
                'payroll_rows' => $payrollRowsCount,
                'paid_rows' => $paidRowsCount,
                'payroll_gross' => $totalPayrollGross,
                'payroll_deductions' => $totalPayrollDeductions,
                'payroll_net' => $totalPayrollNet,
                'expenses_total' => $totalExpenses,
                'tracked_total_cost' => $trackedTotalCost,
                'remaining_budget' => $remainingBudget,
                'budget_utilization_pct' => $utilizationPercent,
            ],
            'selected_cutoff' => $cutoffTotals,
        ];
    }

    private function payrollHistoryPayload(string $group): Collection
    {
        $normalizedGroup = $this->normalizePayrollGroup($group);
        $historyRows = Payroll::query()->whereNotNull('cutoff_id');

        if ($normalizedGroup === 'staff') {
            $historyRows
                ->whereNull('project_id')
                ->selectRaw('
                    cutoff_id,
                    COUNT(*) as payroll_count,
                    SUM(hours) as total_hours,
                    SUM(gross) as total_gross,
                    SUM(deductions) as total_deductions,
                    SUM(net) as total_net,
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as paid_count
                ', [Payroll::STATUS_PAID]);
            $this->applyGroupFilterToPayrollQuery($historyRows, $group);

            $historyRows = $historyRows
                ->groupBy('cutoff_id')
                ->orderByDesc('cutoff_id')
                ->with(['cutoff:id,start_date,end_date,status'])
                ->limit(20)
                ->get();

            return $historyRows
                ->map(function (Payroll $row) use ($group) {
                    $payrollCount = (int) ($row->payroll_count ?? 0);
                    $paidCount = (int) ($row->paid_count ?? 0);
                    $cutoffId = (int) ($row->cutoff_id ?? 0);

                    return [
                        'cutoff_id' => $cutoffId,
                        'project_id' => null,
                        'project_name' => 'Office Payroll',
                        'project_client' => '',
                        'cutoff_start' => optional($row->cutoff?->start_date)?->toDateString(),
                        'cutoff_end' => optional($row->cutoff?->end_date)?->toDateString(),
                        'payroll_count' => $payrollCount,
                        'paid_count' => $paidCount,
                        'status' => $payrollCount > 0 && $paidCount >= $payrollCount
                            ? PayrollCutoff::STATUS_PAID
                            : PayrollCutoff::STATUS_GENERATED,
                        'total_hours' => round((float) ($row->total_hours ?? 0), 2),
                        'total_gross' => round((float) ($row->total_gross ?? 0), 2),
                        'total_deductions' => round((float) ($row->total_deductions ?? 0), 2),
                        'total_net' => round((float) ($row->total_net ?? 0), 2),
                        'transactions' => $this->payrollHistoryTransactionsPayload($cutoffId, null, $group)->all(),
                    ];
                })
                ->values();
        }

        $historyRows
            ->whereNotNull('project_id')
            ->selectRaw('
                cutoff_id,
                project_id,
                MIN(project_name) as project_name,
                MIN(project_client) as project_client,
                COUNT(*) as payroll_count,
                SUM(hours) as total_hours,
                SUM(gross) as total_gross,
                SUM(deductions) as total_deductions,
                SUM(net) as total_net,
                SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as paid_count
            ', [Payroll::STATUS_PAID]);
        $this->applyGroupFilterToPayrollQuery($historyRows, $group);

        $historyRows = $historyRows
            ->groupBy('cutoff_id', 'project_id')
            ->orderByDesc('cutoff_id')
            ->orderBy('project_id')
            ->with([
                'cutoff:id,start_date,end_date,status',
                'project:id,name,client',
            ])
            ->limit(20)
            ->get();

        return $historyRows
            ->map(function (Payroll $row) use ($group) {
                $payrollCount = (int) ($row->payroll_count ?? 0);
                $paidCount = (int) ($row->paid_count ?? 0);
                $projectId = (int) ($row->project_id ?? 0);
                $cutoffId = (int) ($row->cutoff_id ?? 0);

                return [
                    'cutoff_id' => $cutoffId,
                    'project_id' => $projectId > 0 ? $projectId : null,
                    'project_name' => $row->project?->name ?: ($row->project_name ?: '-'),
                    'project_client' => $row->project?->client ?: ($row->project_client ?: '-'),
                    'cutoff_start' => optional($row->cutoff?->start_date)?->toDateString(),
                    'cutoff_end' => optional($row->cutoff?->end_date)?->toDateString(),
                    'payroll_count' => $payrollCount,
                    'paid_count' => $paidCount,
                    'status' => $payrollCount > 0 && $paidCount >= $payrollCount
                        ? PayrollCutoff::STATUS_PAID
                        : PayrollCutoff::STATUS_GENERATED,
                    'total_hours' => round((float) ($row->total_hours ?? 0), 2),
                    'total_gross' => round((float) ($row->total_gross ?? 0), 2),
                    'total_deductions' => round((float) ($row->total_deductions ?? 0), 2),
                    'total_net' => round((float) ($row->total_net ?? 0), 2),
                    'transactions' => $this->payrollHistoryTransactionsPayload($cutoffId, $projectId, $group)->all(),
                ];
            })
            ->values();
    }

    private function payrollHistoryTransactionsPayload(int $cutoffId, ?int $projectId, string $group): Collection
    {
        if ($cutoffId <= 0) {
            return collect();
        }

        $query = Payroll::query()
            ->with(['deductionItems', 'releasedBy:id,fullname'])
            ->where('cutoff_id', $cutoffId);
        if ($projectId !== null && $projectId > 0) {
            $query->where('project_id', $projectId);
        } else {
            $query->whereNull('project_id');
        }
        $this->applyGroupFilterToPayrollQuery($query, $group);

        return $query
            ->orderBy('worker_name')
            ->get()
            ->map(function (Payroll $payroll) {
                $incentives = round((float) $payroll->deductionItems
                    ->where('type', PayrollDeduction::TYPE_INCENTIVE)
                    ->sum('amount'), 2);

                return [
                    'id' => (int) $payroll->id,
                    'worker_name' => (string) ($payroll->worker_name ?? ''),
                    'role' => (string) ($payroll->role ?? ''),
                    'hours' => round((float) ($payroll->hours ?? 0), 2),
                    'rate_per_hour' => round((float) ($payroll->rate_per_hour ?? 0), 2),
                    'gross' => round((float) ($payroll->gross ?? 0), 2),
                    'incentives' => $incentives,
                    'deductions' => round((float) ($payroll->deductions ?? 0), 2),
                    'net' => round((float) ($payroll->net ?? 0), 2),
                    'status' => (string) ($payroll->status ?? ''),
                    'released_at' => optional($payroll->released_at)?->toDateTimeString(),
                    'released_by_name' => $payroll->releasedBy?->fullname,
                    'payment_reference' => $payroll->payment_reference,
                    'bank_export_ref' => $payroll->bank_export_ref,
                ];
            })
            ->values();
    }

    private function applyGroupFilterToPayrollQuery($query, string $group): void
    {
        $normalizedGroup = $this->normalizePayrollGroup($group);
        $roleField = "LOWER(COALESCE(role, ''))";
        $staffRoleMatchers = ['hr', 'human resources', 'admin', 'administrator', 'designer'];

        if ($normalizedGroup === 'staff') {
            $query->where(function ($sub) use ($roleField, $staffRoleMatchers) {
                foreach ($staffRoleMatchers as $matcher) {
                    $sub->orWhereRaw("{$roleField} = ?", [$matcher])
                        ->orWhereRaw("{$roleField} like ?", ['%' . $matcher . '%']);
                }
            })->whereRaw("{$roleField} not like '%head%admin%'");
            return;
        }

        $query->where(function ($sub) use ($roleField, $staffRoleMatchers) {
            $sub->whereRaw("{$roleField} not like '%head%admin%'");
            foreach ($staffRoleMatchers as $matcher) {
                $sub->whereRaw("{$roleField} not like ?", ['%' . $matcher . '%']);
            }
        });
    }

    private function syncWorkerDefaultRate(string $workerName, float $ratePerHour): void
    {
        $name = trim($workerName);
        $rate = round($ratePerHour, 2);

        if ($name === '' || $rate < 0) {
            return;
        }

        $this->payrollRepository->syncDefaultRateByWorkerName($name, $rate);
    }
}
