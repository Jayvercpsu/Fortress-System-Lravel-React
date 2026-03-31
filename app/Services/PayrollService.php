<?php

namespace App\Services;

use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\PayrollDeduction;
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
        $payrolls = $this->payrollRepository->latestPayrollsWithUser($group);
        $totalPayable = $this->payrollRepository->totalPayableByStatuses(Payroll::payableStatuses(), $group);
        $workerOptions = $this->manualPayrollWorkerOptions($group);

        return [
            'payrolls' => $payrolls,
            'totalPayable' => $totalPayable,
            'workerOptions' => $workerOptions,
            'payrollGroup' => $group,
        ];
    }

    public function store(array $validated, int $authId): void
    {
        $gross = (float) $validated['hours'] * (float) $validated['rate_per_hour'];
        $deductions = (float) ($validated['deductions'] ?? 0);
        $net = $gross - $deductions;

        $this->payrollRepository->createPayroll([
            'user_id' => $authId,
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

        $this->payrollRepository->updatePayroll($payroll, [
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

        $selectedCutoff = $this->resolveSelectedCutoff($request, $group);
        $payrollPaginator = $this->payrollRepository->runPayrollPaginator(
            $selectedCutoff?->id,
            $search,
            $perPage,
            $group
        );

        $payrollRows = collect($payrollPaginator->items())
            ->map(fn (Payroll $payroll) => $this->payrollRowPayload($payroll))
            ->values();

        return [
            'cutoffs' => $this->cutoffOptions($group),
            'selectedCutoff' => $selectedCutoff ? $this->cutoffPayload($selectedCutoff, $group) : null,
            'payrollRows' => $payrollRows,
            'payrollGroup' => $group,
            'payrollTable' => [
                'search' => $search,
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
        $normalizedGroup = $this->normalizePayrollGroup((string) $group);

        $attendanceSummary = $this->payrollRepository->attendanceSummaryBetween($startDate, $endDate, $normalizedGroup);

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

            foreach ($this->payrollRepository->workersWithForeman() as $worker) {
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

            foreach ($this->payrollRepository->foremenForRates() as $foreman) {
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
            $aggregates = $this->payrollRepository->payrollAggregatesByCutoffId((int) $existingCutoff->id, $normalizedGroup);
            $paidCount = $this->payrollRepository->paidPayrollCountByCutoffId((int) $existingCutoff->id, $normalizedGroup);
            $payrollCount = (int) ($aggregates['payroll_count'] ?? 0);

            if ($payrollCount > 0 && $paidCount >= $payrollCount) {
                throw ValidationException::withMessages([
                    'start_date' => __('messages.payroll.cutoff_already_paid'),
                ]);
            }
        }

        return DB::transaction(function () use ($startDate, $endDate, $attendanceSummary, $authId, $normalizedGroup) {
            $cutoff = $this->payrollRepository->firstOrCreateCutoff($startDate, $endDate);
            $this->payrollRepository->deletePayrollsByCutoffId((int) $cutoff->id, $normalizedGroup);

            foreach ($attendanceSummary as $row) {
                $hours = round((float) ($row->total_hours ?? 0), 2);
                $rate = $this->resolveRateForWorker((string) $row->worker_name, $row->worker_role ? (string) $row->worker_role : null);
                $gross = round($hours * $rate, 2);

                $this->payrollRepository->createPayroll([
                    'user_id' => $authId,
                    'cutoff_id' => $cutoff->id,
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

    public function markPaid(array $validated, int $authId, ?string $group = null): PayrollCutoff
    {
        $cutoff = $this->payrollRepository->findCutoffById((int) $validated['cutoff_id']);
        abort_unless($cutoff instanceof PayrollCutoff, 404);

        $normalizedGroup = $this->normalizePayrollGroup((string) $group);
        $payrolls = $this->payrollRepository->payrollsByCutoffId((int) $cutoff->id, $normalizedGroup);

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

    public function exportResponse(int $cutoffId, ?string $group = null): StreamedResponse
    {
        $cutoff = $this->payrollRepository->findCutoffById($cutoffId);
        abort_unless($cutoff instanceof PayrollCutoff, 404);

        $normalizedGroup = $this->normalizePayrollGroup((string) $group);
        $payrolls = $this->payrollRepository->payrollsForExportByCutoffId((int) $cutoff->id, $normalizedGroup);

        $filename = sprintf(
            'payroll-cutoff-%s-to-%s.csv',
            optional($cutoff->start_date)->toDateString(),
            optional($cutoff->end_date)->toDateString()
        );

        return response()->streamDownload(function () use ($payrolls, $cutoff) {
            $out = fopen('php://output', 'w');

            fputcsv($out, ['Cutoff Start', optional($cutoff->start_date)->toDateString()]);
            fputcsv($out, ['Cutoff End', optional($cutoff->end_date)->toDateString()]);
            fputcsv($out, ['Status', $cutoff->status]);
            fputcsv($out, []);
            fputcsv($out, [
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
                    $payroll->worker_name,
                    $payroll->role,
                    (float) $payroll->hours,
                    (float) $payroll->rate_per_hour,
                    (float) $payroll->gross,
                    $incentiveTotal,
                    $deductionTotal,
                    (float) $payroll->net,
                    $payroll->status,
                    optional($payroll->released_at)?->toDateTimeString(),
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
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
            'group' => $request->query('group'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    public function runGenerateQueryParams(Request $request, PayrollCutoff $cutoff): array
    {
        return [
            'cutoff_id' => $cutoff->id,
            'per_page' => $request->query('per_page', 10),
            'group' => $request->query('group', 'workers'),
        ];
    }

    public function tableQueryParams(Request $request): array
    {
        return array_filter([
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

    private function resolveSelectedCutoff(Request $request, string $group): ?PayrollCutoff
    {
        $cutoffId = (int) $request->query('cutoff_id', 0);

        if ($cutoffId > 0) {
            $found = $this->payrollRepository->findCutoffById($cutoffId);
            if ($found && $this->hasCutoffRowsForGroup($found, $group)) {
                return $found;
            }
        }

        return $this->latestCutoffForGroup($group);
    }

    private function cutoffOptions(string $group): Collection
    {
        return $this->payrollRepository
            ->cutoffOptionsRows()
            ->map(fn (PayrollCutoff $cutoff) => $this->cutoffPayload($cutoff, $group))
            ->filter(fn (array $payload) => (int) ($payload['payroll_count'] ?? 0) > 0)
            ->values();
    }

    private function cutoffPayload(PayrollCutoff $cutoff, string $group): array
    {
        $aggregates = $this->payrollRepository->payrollAggregatesByCutoffId((int) $cutoff->id, $group);
        $payrollCount = (int) $aggregates['payroll_count'];
        $paidCount = $this->payrollRepository->paidPayrollCountByCutoffId((int) $cutoff->id, $group);
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
        $payroll->loadMissing(['deductionItems', 'releasedBy:id,fullname']);

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

    private function manualPayrollWorkerOptions(string $group): Collection
    {
        if ($group === 'staff') {
            $options = [];

            $latestPayrollWorkers = $this->payrollRepository->latestPayrollWorkers();
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

        $latestPayrollWorkers = $this->payrollRepository->latestPayrollWorkers();
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

        $workers = $this->payrollRepository->workersForOptions();
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

        $foremen = $this->payrollRepository->foremenForOptions();
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

    private function hasCutoffRowsForGroup(PayrollCutoff $cutoff, string $group): bool
    {
        $aggregates = $this->payrollRepository->payrollAggregatesByCutoffId((int) $cutoff->id, $group);
        return (int) ($aggregates['payroll_count'] ?? 0) > 0;
    }

    private function latestCutoffForGroup(string $group): ?PayrollCutoff
    {
        $candidates = $this->payrollRepository->cutoffOptionsRows();
        foreach ($candidates as $cutoff) {
            if ($this->hasCutoffRowsForGroup($cutoff, $group)) {
                return $cutoff;
            }
        }

        return null;
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
