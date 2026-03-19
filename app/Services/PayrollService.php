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
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayrollService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly PayrollRepositoryInterface $payrollRepository
    ) {
    }

    public function indexPayload(): array
    {
        $payrolls = $this->payrollRepository->latestPayrollsWithUser();
        $totalPayable = $this->payrollRepository->totalPayableByStatuses(Payroll::payableStatuses());
        $workerOptions = $this->manualPayrollWorkerOptions();

        return [
            'payrolls' => $payrolls,
            'totalPayable' => $totalPayable,
            'workerOptions' => $workerOptions,
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

    public function runPayload(Request $request): array
    {
        [$search, $perPage] = $this->runTableParams($request);

        $selectedCutoff = $this->resolveSelectedCutoff($request);
        $payrollPaginator = $this->payrollRepository->runPayrollPaginator(
            $selectedCutoff?->id,
            $search,
            $perPage
        );

        $payrollRows = collect($payrollPaginator->items())
            ->map(fn (Payroll $payroll) => $this->payrollRowPayload($payroll))
            ->values();

        return [
            'cutoffs' => $this->cutoffOptions(),
            'selectedCutoff' => $selectedCutoff ? $this->cutoffPayload($selectedCutoff) : null,
            'payrollRows' => $payrollRows,
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

    public function generateFromAttendance(array $validated, int $authId): PayrollCutoff
    {
        $startDate = $validated['start_date'];
        $endDate = $validated['end_date'];

        $attendanceSummary = $this->payrollRepository->attendanceSummaryBetween($startDate, $endDate);

        if ($attendanceSummary->isEmpty()) {
            throw ValidationException::withMessages([
                'start_date' => __('messages.payroll.no_attendance_for_cutoff'),
            ]);
        }

        $existingCutoff = $this->payrollRepository->findCutoffByRange($startDate, $endDate);

        if ($existingCutoff && $existingCutoff->status === PayrollCutoff::STATUS_PAID) {
            throw ValidationException::withMessages([
                'start_date' => __('messages.payroll.cutoff_already_paid'),
            ]);
        }

        return DB::transaction(function () use ($startDate, $endDate, $attendanceSummary, $authId) {
            $cutoff = $this->payrollRepository->firstOrCreateCutoff($startDate, $endDate);
            $this->payrollRepository->deletePayrollsByCutoffId((int) $cutoff->id);

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

    public function markPaid(array $validated, int $authId): PayrollCutoff
    {
        $cutoff = $this->payrollRepository->findCutoffById((int) $validated['cutoff_id']);
        abort_unless($cutoff instanceof PayrollCutoff, 404);

        $payrolls = $this->payrollRepository->payrollsByCutoffId((int) $cutoff->id);

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

            $cutoff->update(['status' => PayrollCutoff::STATUS_PAID]);
        });

        return $cutoff;
    }

    public function exportResponse(int $cutoffId): StreamedResponse
    {
        $cutoff = $this->payrollRepository->findCutoffById($cutoffId);
        abort_unless($cutoff instanceof PayrollCutoff, 404);

        $payrolls = $this->payrollRepository->payrollsForExportByCutoffId((int) $cutoff->id);

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
                'Deductions',
                'Net Pay',
                'Status',
                'Released At',
                'Payment Reference',
                'Bank Export Ref',
            ]);

            foreach ($payrolls as $payroll) {
                $deductionTotal = round((float) $payroll->deductionItems->sum('amount'), 2);
                fputcsv($out, [
                    $payroll->worker_name,
                    $payroll->role,
                    (float) $payroll->hours,
                    (float) $payroll->rate_per_hour,
                    (float) $payroll->gross,
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
        ], fn ($value) => $value !== null && $value !== '');
    }

    public function markPaidQueryParams(Request $request, PayrollCutoff $cutoff): array
    {
        return array_filter([
            'cutoff_id' => $cutoff->id,
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    public function runGenerateQueryParams(Request $request, PayrollCutoff $cutoff): array
    {
        return [
            'cutoff_id' => $cutoff->id,
            'per_page' => $request->query('per_page', 10),
        ];
    }

    public function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
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

    private function resolveSelectedCutoff(Request $request): ?PayrollCutoff
    {
        $cutoffId = (int) $request->query('cutoff_id', 0);

        if ($cutoffId > 0) {
            $found = $this->payrollRepository->findCutoffById($cutoffId);
            if ($found) {
                return $found;
            }
        }

        return $this->payrollRepository->latestCutoff();
    }

    private function cutoffOptions(): Collection
    {
        return $this->payrollRepository
            ->cutoffOptionsRows()
            ->map(fn (PayrollCutoff $cutoff) => $this->cutoffPayload($cutoff))
            ->values();
    }

    private function cutoffPayload(PayrollCutoff $cutoff): array
    {
        $aggregates = $this->payrollRepository->payrollAggregatesByCutoffId((int) $cutoff->id);

        return [
            'id' => $cutoff->id,
            'start_date' => optional($cutoff->start_date)?->toDateString(),
            'end_date' => optional($cutoff->end_date)?->toDateString(),
            'status' => $cutoff->status,
            'payroll_count' => isset($cutoff->payrolls_count) ? (int) $cutoff->payrolls_count : (int) $aggregates['payroll_count'],
            'total_hours' => round((float) (isset($cutoff->total_hours_sum) ? $cutoff->total_hours_sum : $aggregates['total_hours']), 2),
            'total_gross' => round((float) (isset($cutoff->total_gross_sum) ? $cutoff->total_gross_sum : $aggregates['total_gross']), 2),
            'total_deductions' => round((float) (isset($cutoff->total_deductions_sum) ? $cutoff->total_deductions_sum : $aggregates['total_deductions']), 2),
            'total_net' => round((float) (isset($cutoff->total_net_sum) ? $cutoff->total_net_sum : $aggregates['total_net']), 2),
            'paid_count' => $this->payrollRepository->paidPayrollCountByCutoffId((int) $cutoff->id),
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
        $net = round($gross - $deductions, 2);

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

    private function manualPayrollWorkerOptions(): Collection
    {
        $options = [];

        $latestPayrollWorkers = $this->payrollRepository->latestPayrollWorkers();
        foreach ($latestPayrollWorkers as $payroll) {
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
