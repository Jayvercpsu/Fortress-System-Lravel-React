<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Expense;
use App\Models\Payroll;
use App\Models\Project;
use App\Models\ProjectScope;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Inertia\Inertia;

class ReportsController extends Controller
{
    public function index(Request $request)
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'admin'], true), 403);

        $projects = Project::query()
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'client',
                'status',
                'phase',
                'overall_progress',
                'contract_amount',
                'total_client_payment',
                'remaining_balance',
            ]);

        $expenseByProject = Expense::query()
            ->selectRaw('project_id, COALESCE(SUM(amount), 0) as total_amount')
            ->groupBy('project_id')
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->project_id => round((float) ($row->total_amount ?? 0), 2)]);

        $attendanceByWorker = Attendance::query()
            ->whereNotNull('project_id')
            ->get(['worker_name', 'date', 'project_id', 'hours'])
            ->groupBy(fn (Attendance $attendance) => mb_strtolower(trim((string) $attendance->worker_name)));

        $allocatedPayrollByProject = [];
        $unallocatedPayrollTotal = 0.0;

        $payrollRows = Payroll::query()
            ->with('cutoff:id,start_date,end_date')
            ->get(['id', 'cutoff_id', 'worker_name', 'net', 'week_start']);

        foreach ($payrollRows as $payroll) {
            $net = round((float) ($payroll->net ?? 0), 2);
            if ($net <= 0) {
                continue;
            }

            $workerKey = mb_strtolower(trim((string) $payroll->worker_name));
            if ($workerKey === '') {
                $unallocatedPayrollTotal += $net;
                continue;
            }

            [$startDate, $endDate] = $this->resolvePayrollDateRange($payroll);

            $workerAttendance = $attendanceByWorker->get($workerKey, collect())
                ->filter(function (Attendance $attendance) use ($startDate, $endDate) {
                    if (!$attendance->project_id || !$attendance->date) {
                        return false;
                    }

                    /** @var Carbon $date */
                    $date = $attendance->date;

                    return $date->greaterThanOrEqualTo($startDate) && $date->lessThanOrEqualTo($endDate);
                });

            if ($workerAttendance->isEmpty()) {
                $unallocatedPayrollTotal += $net;
                continue;
            }

            $hoursByProject = $workerAttendance
                ->groupBy('project_id')
                ->map(fn (Collection $rows) => (float) $rows->sum(fn (Attendance $attendance) => (float) ($attendance->hours ?? 0)))
                ->filter(fn (float $hours) => $hours > 0);

            $totalHours = (float) $hoursByProject->sum();

            if ($totalHours <= 0) {
                $unallocatedPayrollTotal += $net;
                continue;
            }

            $projectIds = $hoursByProject->keys()->values();
            $remaining = $net;

            foreach ($projectIds as $index => $projectId) {
                $hours = (float) ($hoursByProject[$projectId] ?? 0);

                $allocated = $index === ($projectIds->count() - 1)
                    ? $remaining
                    : round($net * ($hours / $totalHours), 2);

                $remaining = round($remaining - $allocated, 2);
                $key = (int) $projectId;
                $allocatedPayrollByProject[$key] = round(((float) ($allocatedPayrollByProject[$key] ?? 0)) + $allocated, 2);
            }
        }

        $scopeAggregates = ProjectScope::query()
            ->selectRaw('project_id, SUM(contract_amount) as total_scope_contract, SUM(weight_percent) as total_weight_percent, SUM(contract_amount * progress_percent / 100) as accomplished_amount, SUM(weight_percent * progress_percent / 100) as weighted_progress')
            ->groupBy('project_id')
            ->get()
            ->keyBy(fn ($row) => (int) $row->project_id);

        $rows = $projects->map(function (Project $project) use ($expenseByProject, $allocatedPayrollByProject, $scopeAggregates) {
            $projectId = (int) $project->id;
            $contractAmount = round((float) $project->contract_amount, 2);
            $collectedAmount = round((float) $project->total_client_payment, 2);
            $remainingBalance = round((float) $project->remaining_balance, 2);
            $expenseTotal = round((float) ($expenseByProject[$projectId] ?? 0), 2);
            $allocatedPayroll = round((float) ($allocatedPayrollByProject[$projectId] ?? 0), 2);
            $totalCost = round($expenseTotal + $allocatedPayroll, 2);
            $profitCollectedBasis = round($collectedAmount - $totalCost, 2);
            $profitContractBasis = round($contractAmount - $totalCost, 2);
            $scopeInfo = $scopeAggregates->get($projectId);
            $scopeContractTotal = round((float) ($scopeInfo->total_scope_contract ?? 0), 2);
            $weightedProgressPct = $scopeInfo ? round((float) ($scopeInfo->weighted_progress ?? 0), 2) : 0.0;
            $computedAmount = round((float) ($scopeInfo->accomplished_amount ?? 0), 2);

            return [
                'id' => $projectId,
                'name' => $project->name,
                'client' => $project->client,
                'status' => $project->status,
                'phase' => $project->phase,
                'overall_progress' => (int) ($project->overall_progress ?? 0),
                'contract_amount' => $contractAmount,
                'collected_amount' => $collectedAmount,
                'remaining_balance' => $remainingBalance,
                'expense_total' => $expenseTotal,
                'allocated_payroll_total' => $allocatedPayroll,
                'total_cost' => $totalCost,
                'profit_collected_basis' => $profitCollectedBasis,
                'profit_contract_basis' => $profitContractBasis,
                'scope_contract_total' => $scopeContractTotal,
                'computed_amount_to_date' => $computedAmount,
                'weighted_progress_percent' => $weightedProgressPct,
                'profit_margin_collected_percent' => $collectedAmount > 0
                    ? round(($profitCollectedBasis / $collectedAmount) * 100, 1)
                    : null,
                'profit_margin_contract_percent' => $contractAmount > 0
                    ? round(($profitContractBasis / $contractAmount) * 100, 1)
                    : null,
            ];
        })->values();

        $summary = [
            'project_count' => $rows->count(),
            'contract_sum' => round((float) $rows->sum('contract_amount'), 2),
            'collected_sum' => round((float) $rows->sum('collected_amount'), 2),
            'expense_sum' => round((float) $rows->sum('expense_total'), 2),
            'allocated_payroll_sum' => round((float) $rows->sum('allocated_payroll_total'), 2),
            'total_cost_sum' => round((float) $rows->sum('total_cost'), 2),
            'profit_collected_basis_sum' => round((float) $rows->sum('profit_collected_basis'), 2),
            'profit_contract_basis_sum' => round((float) $rows->sum('profit_contract_basis'), 2),
            'unallocated_payroll_total' => round($unallocatedPayrollTotal, 2),
        ];

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Reports/Index'
            : 'Admin/Reports/Index';

        return Inertia::render($page, [
            'summary' => $summary,
            'projectProfitability' => $rows,
        ]);
    }

    private function resolvePayrollDateRange(Payroll $payroll): array
    {
        $start = $payroll->cutoff?->start_date;
        $end = $payroll->cutoff?->end_date;

        if ($start && $end) {
            return [$start->copy()->startOfDay(), $end->copy()->endOfDay()];
        }

        $weekStart = $payroll->week_start
            ? Carbon::parse($payroll->week_start)
            : now()->startOfWeek();

        return [
            $weekStart->copy()->startOfDay(),
            $weekStart->copy()->addDays(6)->endOfDay(),
        ];
    }
}
