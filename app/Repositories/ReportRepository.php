<?php

namespace App\Repositories;

use App\Models\Attendance;
use App\Models\Expense;
use App\Models\Payroll;
use App\Models\Project;
use App\Models\ProjectScope;
use App\Repositories\Contracts\ReportRepositoryInterface;
use Illuminate\Support\Collection;

class ReportRepository implements ReportRepositoryInterface
{
    public function nonDesignProjects(): Collection
    {
        return Project::query()
            ->whereRaw('LOWER(TRIM(COALESCE(phase, \'\'))) != ?', [strtolower(Project::PHASE_DESIGN)])
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
    }

    public function expenseTotalsByProject(): Collection
    {
        return Expense::query()
            ->selectRaw('project_id, COALESCE(SUM(amount), 0) as total_amount')
            ->groupBy('project_id')
            ->get();
    }

    public function attendanceGroupedByWorker(): Collection
    {
        return Attendance::query()
            ->whereNotNull('project_id')
            ->get(['worker_name', 'date', 'project_id', 'hours'])
            ->groupBy(fn (Attendance $attendance) => mb_strtolower(trim((string) $attendance->worker_name)));
    }

    public function payrollRowsWithCutoff(): Collection
    {
        return Payroll::query()
            ->with('cutoff:id,start_date,end_date')
            ->get(['id', 'cutoff_id', 'worker_name', 'net', 'week_start']);
    }

    public function scopeAggregatesByProject(): Collection
    {
        return ProjectScope::query()
            ->selectRaw('project_id, SUM(contract_amount) as total_scope_contract, SUM(weight_percent) as total_weight_percent, SUM(contract_amount * progress_percent / 100) as accomplished_amount, SUM(weight_percent * progress_percent / 100) as weighted_progress')
            ->groupBy('project_id')
            ->get();
    }
}
