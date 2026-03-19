<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Payroll;
use App\Models\Project;
use App\Models\User;
use App\Repositories\Contracts\ReportRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ReportService
{
    public function __construct(
        private readonly ReportRepositoryInterface $reportRepository
    ) {
    }

    public function ensureAuthorized($user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function indexPayload(Request $request): array
    {
        $projects = $this->reportRepository->nonDesignProjects();

        $expenseByProject = $this->reportRepository->expenseTotalsByProject()
            ->mapWithKeys(fn ($row) => [(int) $row->project_id => round((float) ($row->total_amount ?? 0), 2)]);

        $attendanceByWorker = $this->reportRepository->attendanceGroupedByWorker();

        $allocatedPayrollByProject = [];
        $unallocatedPayrollTotal = 0.0;

        $payrollRows = $this->reportRepository->payrollRowsWithCutoff();

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

        $scopeAggregates = $this->reportRepository->scopeAggregatesByProject()
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

        $page = $request->user()->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Reports/Index'
            : 'Admin/Reports/Index';

        return [
            'page' => $page,
            'props' => [
                'summary' => $summary,
                'projectProfitability' => $rows,
            ],
        ];
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
