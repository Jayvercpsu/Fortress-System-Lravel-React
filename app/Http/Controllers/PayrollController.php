<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\PayrollDeduction;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PayrollController extends Controller
{
    public function index()
    {
        $payrolls = Payroll::with('user')->latest()->get();
        $totalPayable = Payroll::whereIn('status', ['pending', 'ready', 'approved'])->sum('net');
        $workerOptions = $this->manualPayrollWorkerOptions();

        return Inertia::render('HR/Payroll', compact('payrolls', 'totalPayable', 'workerOptions'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'worker_name'   => 'required|string',
            'role'          => 'required|string',
            'hours'         => 'required|numeric|min:0',
            'rate_per_hour' => 'required|numeric|min:0',
            'deductions'    => 'nullable|numeric|min:0',
            'week_start'    => 'required|date',
        ]);

        $gross = $request->hours * $request->rate_per_hour;
        $deductions = $request->deductions ?? 0;
        $net = $gross - $deductions;

        Payroll::create([
            'user_id'       => Auth::id(),
            'worker_name'   => $request->worker_name,
            'role'          => $request->role,
            'hours'         => $request->hours,
            'rate_per_hour' => $request->rate_per_hour,
            'gross'         => $gross,
            'deductions'    => $deductions,
            'net'           => $net,
            'week_start'    => $request->week_start,
        ]);

        $this->syncWorkerDefaultRate((string) $request->worker_name, (float) $request->rate_per_hour);

        return back()->with('success', 'Payroll entry added.');
    }

    public function updateStatus(Request $request, Payroll $payroll)
    {
        $request->validate([
            'status' => 'required|in:pending,ready,approved,paid'
        ]);

        $payroll->update([
            'status' => $request->status
        ]);

        return back()->with('success', 'Status updated.');
    }

    public function update(Request $request, Payroll $payroll)
    {
        $validated = $request->validate([
            'worker_name' => 'required|string|max:255',
            'role' => 'required|string|max:255',
            'week_start' => 'required|date',
            'hours' => 'required|numeric|min:0',
            'rate_per_hour' => 'required|numeric|min:0',
            'deductions' => 'nullable|numeric|min:0',
            'status' => 'required|in:pending,ready,approved,paid',
        ]);

        $gross = round((float) $validated['hours'] * (float) $validated['rate_per_hour'], 2);
        $deductions = round((float) ($validated['deductions'] ?? 0), 2);
        $net = round($gross - $deductions, 2);

        $payroll->update([
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

        return back()->with('success', 'Payroll entry updated.');
    }

    public function run(Request $request)
    {
        [$search, $perPage] = $this->runTableParams($request);

        $selectedCutoff = $this->resolveSelectedCutoff($request);
        $payrollPaginator = Payroll::query()
            ->with(['deductionItems', 'releasedBy:id,fullname'])
            ->when($selectedCutoff, fn ($q) => $q->where('cutoff_id', $selectedCutoff->id), fn ($q) => $q->whereRaw('1=0'))
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($sub) use ($search) {
                    $sub
                        ->where('worker_name', 'like', "%{$search}%")
                        ->orWhere('role', 'like', "%{$search}%")
                        ->orWhere('status', 'like', "%{$search}%");
                });
            })
            ->orderBy('worker_name')
            ->paginate($perPage)
            ->withQueryString();

        $payrollRows = collect($payrollPaginator->items())
            ->map(fn (Payroll $payroll) => $this->payrollRowPayload($payroll))
            ->values();

        return Inertia::render('HR/PayrollRun', [
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
        ]);
    }

    public function workerRates(Request $request)
    {
        [$search, $perPage] = $this->runTableParams($request);

        $needle = mb_strtolower($search);

        $workerRows = Worker::query()
            ->with('foreman:id,fullname')
            ->orderBy('name')
            ->get()
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

        $foremanRows = User::query()
            ->where('role', 'foreman')
            ->orderBy('fullname')
            ->get(['id', 'fullname', 'email', 'default_rate_per_hour', 'updated_at'])
            ->map(function (User $foreman) use ($needle) {
                $row = [
                    'id' => $foreman->id,
                    'entity_type' => 'foreman',
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

        return Inertia::render('HR/WorkerRates', [
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
        ]);
    }

    public function updateWorkerRate(Request $request, Worker $worker)
    {
        $validated = $request->validate([
            'default_rate_per_hour' => 'required|numeric|min:0',
        ]);

        $worker->update([
            'default_rate_per_hour' => round((float) $validated['default_rate_per_hour'], 2),
        ]);

        return redirect()
            ->route('payroll.worker_rates', $this->tableQueryParams($request))
            ->with('success', 'Worker rate updated.');
    }

    public function updateForemanRate(Request $request, User $user)
    {
        abort_unless($user->role === 'foreman', 404);

        $validated = $request->validate([
            'default_rate_per_hour' => 'required|numeric|min:0',
        ]);

        $user->update([
            'default_rate_per_hour' => round((float) $validated['default_rate_per_hour'], 2),
        ]);

        return redirect()
            ->route('payroll.worker_rates', $this->tableQueryParams($request))
            ->with('success', 'Foreman rate updated.');
    }

    public function generateFromAttendance(Request $request)
    {
        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $startDate = $validated['start_date'];
        $endDate = $validated['end_date'];

        $attendanceSummary = Attendance::query()
            ->whereBetween('date', [$startDate, $endDate])
            ->selectRaw('worker_name, worker_role, COALESCE(SUM(hours), 0) as total_hours')
            ->groupBy('worker_name', 'worker_role')
            ->orderBy('worker_name')
            ->get();

        if ($attendanceSummary->isEmpty()) {
            return back()->withErrors([
                'start_date' => 'No attendance records were found for the selected cutoff range.',
            ]);
        }

        $existingCutoff = PayrollCutoff::query()
            ->whereDate('start_date', $startDate)
            ->whereDate('end_date', $endDate)
            ->first();

        if ($existingCutoff && $existingCutoff->status === 'paid') {
            return back()->withErrors([
                'start_date' => 'This cutoff is already marked paid and cannot be regenerated.',
            ]);
        }

        $cutoff = DB::transaction(function () use ($startDate, $endDate, $attendanceSummary) {
            $cutoff = PayrollCutoff::query()->firstOrCreate(
                ['start_date' => $startDate, 'end_date' => $endDate],
                ['status' => 'generated']
            );

            Payroll::query()->where('cutoff_id', $cutoff->id)->delete();

            foreach ($attendanceSummary as $row) {
                $hours = round((float) ($row->total_hours ?? 0), 2);
                $rate = $this->resolveRateForWorker($row->worker_name, $row->worker_role);
                $gross = round($hours * $rate, 2);

                Payroll::create([
                    'user_id' => Auth::id(),
                    'cutoff_id' => $cutoff->id,
                    'worker_name' => $row->worker_name,
                    'role' => $row->worker_role ?: 'Labor',
                    'hours' => $hours,
                    'rate_per_hour' => $rate,
                    'gross' => $gross,
                    'deductions' => 0,
                    'net' => $gross,
                    'status' => 'ready',
                    'week_start' => $startDate,
                ]);
            }

            $cutoff->update(['status' => 'generated']);

            return $cutoff;
        });

        return redirect()->route('payroll.run', [
            'cutoff_id' => $cutoff->id,
            'per_page' => $request->query('per_page', 10),
        ]);
    }

    public function addDeduction(Request $request, Payroll $payroll)
    {
        $this->assertPayrollEditable($payroll);

        $validated = $request->validate([
            'type' => 'required|in:cash_advance,loan,other',
            'amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:1000',
        ]);

        $payroll->deductionItems()->create($validated);
        $this->syncPayrollFinancials($payroll);

        return redirect()->route('payroll.run', $this->payrollRunQueryParams($request, $payroll));
    }

    public function updateDeduction(Request $request, PayrollDeduction $payrollDeduction)
    {
        $payroll = $payrollDeduction->payroll()->firstOrFail();
        $this->assertPayrollEditable($payroll);

        $validated = $request->validate([
            'type' => 'required|in:cash_advance,loan,other',
            'amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:1000',
        ]);

        $payrollDeduction->update($validated);
        $this->syncPayrollFinancials($payroll);

        return redirect()->route('payroll.run', $this->payrollRunQueryParams($request, $payroll));
    }

    public function destroyDeduction(Request $request, PayrollDeduction $payrollDeduction)
    {
        $payroll = $payrollDeduction->payroll()->firstOrFail();
        $this->assertPayrollEditable($payroll);

        $payrollDeduction->delete();
        $this->syncPayrollFinancials($payroll);

        return redirect()->route('payroll.run', $this->payrollRunQueryParams($request, $payroll));
    }

    public function markPaid(Request $request)
    {
        $validated = $request->validate([
            'cutoff_id' => 'required|exists:payroll_cutoffs,id',
            'payment_reference' => 'nullable|string|max:255',
            'bank_export_ref' => 'nullable|string|max:255',
        ]);

        $cutoff = PayrollCutoff::query()->findOrFail($validated['cutoff_id']);
        $payrolls = Payroll::query()->where('cutoff_id', $cutoff->id)->get();

        if ($payrolls->isEmpty()) {
            return back()->withErrors([
                'cutoff_id' => 'No payroll rows found for the selected cutoff.',
            ]);
        }

        $now = now();
        $authId = Auth::id();

        DB::transaction(function () use ($payrolls, $cutoff, $validated, $now, $authId) {
            foreach ($payrolls as $payroll) {
                $this->syncPayrollFinancials($payroll);
                $payroll->update([
                    'status' => 'paid',
                    'released_at' => $now,
                    'released_by' => $authId,
                    'payment_reference' => $validated['payment_reference'] ?? null,
                    'bank_export_ref' => $validated['bank_export_ref'] ?? null,
                ]);
            }

            $cutoff->update(['status' => 'paid']);
        });

        return redirect()->route('payroll.run', array_filter([
            'cutoff_id' => $cutoff->id,
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== ''));
    }

    public function export(Request $request)
    {
        $validated = $request->validate([
            'cutoff_id' => 'required|exists:payroll_cutoffs,id',
        ]);

        $cutoff = PayrollCutoff::query()->findOrFail($validated['cutoff_id']);
        $payrolls = Payroll::query()
            ->with('deductionItems')
            ->where('cutoff_id', $cutoff->id)
            ->orderBy('worker_name')
            ->get();

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

    private function runTableParams(Request $request): array
    {
        $allowedPerPage = [5, 10, 25, 50];
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        return [$search, $perPage];
    }

    private function resolveSelectedCutoff(Request $request): ?PayrollCutoff
    {
        $cutoffId = $request->query('cutoff_id');

        if ($cutoffId) {
            $found = PayrollCutoff::query()->find($cutoffId);
            if ($found) {
                return $found;
            }
        }

        return PayrollCutoff::query()->orderByDesc('end_date')->orderByDesc('id')->first();
    }

    private function cutoffOptions()
    {
        $cutoffs = PayrollCutoff::query()
            ->withCount('payrolls')
            ->withSum('payrolls as total_hours_sum', 'hours')
            ->withSum('payrolls as total_gross_sum', 'gross')
            ->withSum('payrolls as total_deductions_sum', 'deductions')
            ->withSum('payrolls as total_net_sum', 'net')
            ->orderByDesc('end_date')
            ->orderByDesc('id')
            ->take(20)
            ->get();

        return $cutoffs->map(fn (PayrollCutoff $cutoff) => $this->cutoffPayload($cutoff))->values();
    }

    private function cutoffPayload(PayrollCutoff $cutoff): array
    {
        $payrolls = Payroll::query()->where('cutoff_id', $cutoff->id);

        return [
            'id' => $cutoff->id,
            'start_date' => optional($cutoff->start_date)?->toDateString(),
            'end_date' => optional($cutoff->end_date)?->toDateString(),
            'status' => $cutoff->status,
            'payroll_count' => isset($cutoff->payrolls_count) ? (int) $cutoff->payrolls_count : (int) (clone $payrolls)->count(),
            'total_hours' => round((float) (isset($cutoff->total_hours_sum) ? $cutoff->total_hours_sum : (clone $payrolls)->sum('hours')), 2),
            'total_gross' => round((float) (isset($cutoff->total_gross_sum) ? $cutoff->total_gross_sum : (clone $payrolls)->sum('gross')), 2),
            'total_deductions' => round((float) (isset($cutoff->total_deductions_sum) ? $cutoff->total_deductions_sum : (clone $payrolls)->sum('deductions')), 2),
            'total_net' => round((float) (isset($cutoff->total_net_sum) ? $cutoff->total_net_sum : (clone $payrolls)->sum('net')), 2),
            'paid_count' => (int) Payroll::query()->where('cutoff_id', $cutoff->id)->where('status', 'paid')->count(),
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
            'can_edit_deductions' => $payroll->status !== 'paid',
            'deduction_items' => $deductionItems,
        ];
    }

    private function syncPayrollFinancials(Payroll $payroll): void
    {
        $payroll->refresh();
        $gross = round((float) $payroll->hours * (float) $payroll->rate_per_hour, 2);
        $deductions = round((float) $payroll->deductionItems()->sum('amount'), 2);
        $net = round($gross - $deductions, 2);

        $payroll->update([
            'gross' => $gross,
            'deductions' => $deductions,
            'net' => $net,
        ]);
    }

    private function resolveRateForWorker(string $workerName, ?string $role): float
    {
        $workerRate = Worker::query()
            ->where('name', $workerName)
            ->whereNotNull('default_rate_per_hour')
            ->where('default_rate_per_hour', '>', 0)
            ->orderByDesc('id')
            ->value('default_rate_per_hour');

        if ($workerRate !== null) {
            return round((float) $workerRate, 2);
        }

        $foremanRate = User::query()
            ->where('role', 'foreman')
            ->where('fullname', $workerName)
            ->whereNotNull('default_rate_per_hour')
            ->where('default_rate_per_hour', '>', 0)
            ->orderByDesc('id')
            ->value('default_rate_per_hour');

        if ($foremanRate !== null) {
            return round((float) $foremanRate, 2);
        }

        $exactRate = Payroll::query()
            ->where('worker_name', $workerName)
            ->where('rate_per_hour', '>', 0)
            ->orderByDesc('id')
            ->value('rate_per_hour');

        if ($exactRate !== null) {
            return round((float) $exactRate, 2);
        }

        if ($role) {
            $roleRate = Payroll::query()
                ->where('role', $role)
                ->where('rate_per_hour', '>', 0)
                ->orderByDesc('id')
                ->value('rate_per_hour');

            if ($roleRate !== null) {
                return round((float) $roleRate, 2);
            }
        }

        return 0.0;
    }

    private function assertPayrollEditable(Payroll $payroll): void
    {
        if ($payroll->status === 'paid' || $payroll->cutoff?->status === 'paid') {
            throw ValidationException::withMessages([
                'payroll' => 'Paid payroll rows are locked.',
            ]);
        }
    }

    private function payrollRunQueryParams(Request $request, Payroll $payroll): array
    {
        return array_filter([
            'cutoff_id' => $request->query('cutoff_id', $payroll->cutoff_id),
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function manualPayrollWorkerOptions()
    {
        $options = [];

        $latestPayrollWorkers = Payroll::query()
            ->whereNotNull('worker_name')
            ->where('worker_name', '!=', '')
            ->orderByDesc('id')
            ->get(['worker_name', 'role', 'rate_per_hour']);

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

        $workers = Worker::query()
            ->whereNotNull('name')
            ->where('name', '!=', '')
            ->orderByDesc('id')
            ->get(['name', 'default_rate_per_hour']);

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

        $foremen = User::query()
            ->where('role', 'foreman')
            ->whereNotNull('fullname')
            ->where('fullname', '!=', '')
            ->orderByDesc('id')
            ->get(['fullname', 'default_rate_per_hour']);

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

        Worker::query()
            ->where('name', $name)
            ->update(['default_rate_per_hour' => $rate]);

        User::query()
            ->where('role', 'foreman')
            ->where('fullname', $name)
            ->update(['default_rate_per_hour' => $rate]);
    }

    private function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }
}
