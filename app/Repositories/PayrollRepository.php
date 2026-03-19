<?php

namespace App\Repositories;

use App\Models\Attendance;
use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\PayrollDeduction;
use App\Models\User;
use App\Models\Worker;
use App\Repositories\Contracts\PayrollRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class PayrollRepository implements PayrollRepositoryInterface
{
    public function latestPayrollsWithUser(): EloquentCollection
    {
        return Payroll::query()
            ->with('user')
            ->latest()
            ->get();
    }

    public function totalPayableByStatuses(array $statuses): float
    {
        return (float) Payroll::query()
            ->whereIn('status', $statuses)
            ->sum('net');
    }

    public function latestPayrollWorkers(): EloquentCollection
    {
        return Payroll::query()
            ->whereNotNull('worker_name')
            ->where('worker_name', '!=', '')
            ->orderByDesc('id')
            ->get(['worker_name', 'role', 'rate_per_hour']);
    }

    public function workersForOptions(): EloquentCollection
    {
        return Worker::query()
            ->whereNotNull('name')
            ->where('name', '!=', '')
            ->orderByDesc('id')
            ->get(['name', 'default_rate_per_hour']);
    }

    public function foremenForOptions(): EloquentCollection
    {
        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->whereNotNull('fullname')
            ->where('fullname', '!=', '')
            ->orderByDesc('id')
            ->get(['fullname', 'default_rate_per_hour']);
    }

    public function createPayroll(array $attributes): Payroll
    {
        return Payroll::query()->create($attributes);
    }

    public function updatePayroll(Payroll $payroll, array $attributes): void
    {
        $payroll->update($attributes);
    }

    public function runPayrollPaginator(?int $cutoffId, string $search, int $perPage): LengthAwarePaginator
    {
        return Payroll::query()
            ->with(['deductionItems', 'releasedBy:id,fullname'])
            ->when($cutoffId, fn ($q) => $q->where('cutoff_id', $cutoffId), fn ($q) => $q->whereRaw('1=0'))
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
    }

    public function findCutoffById(int $id): ?PayrollCutoff
    {
        return PayrollCutoff::query()->find($id);
    }

    public function latestCutoff(): ?PayrollCutoff
    {
        return PayrollCutoff::query()
            ->orderByDesc('end_date')
            ->orderByDesc('id')
            ->first();
    }

    public function cutoffOptionsRows(int $limit = 20): EloquentCollection
    {
        return PayrollCutoff::query()
            ->withCount('payrolls')
            ->withSum('payrolls as total_hours_sum', 'hours')
            ->withSum('payrolls as total_gross_sum', 'gross')
            ->withSum('payrolls as total_deductions_sum', 'deductions')
            ->withSum('payrolls as total_net_sum', 'net')
            ->orderByDesc('end_date')
            ->orderByDesc('id')
            ->take($limit)
            ->get();
    }

    public function payrollAggregatesByCutoffId(int $cutoffId): array
    {
        $payrolls = Payroll::query()->where('cutoff_id', $cutoffId);

        return [
            'payroll_count' => (int) (clone $payrolls)->count(),
            'total_hours' => round((float) (clone $payrolls)->sum('hours'), 2),
            'total_gross' => round((float) (clone $payrolls)->sum('gross'), 2),
            'total_deductions' => round((float) (clone $payrolls)->sum('deductions'), 2),
            'total_net' => round((float) (clone $payrolls)->sum('net'), 2),
        ];
    }

    public function paidPayrollCountByCutoffId(int $cutoffId): int
    {
        return Payroll::query()
            ->where('cutoff_id', $cutoffId)
            ->where('status', Payroll::STATUS_PAID)
            ->count();
    }

    public function workersWithForeman(): EloquentCollection
    {
        return Worker::query()
            ->with('foreman:id,fullname')
            ->orderBy('name')
            ->get();
    }

    public function foremenForRates(): EloquentCollection
    {
        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname', 'email', 'default_rate_per_hour', 'updated_at']);
    }

    public function updateWorkerDefaultRate(Worker $worker, float $rate): void
    {
        $worker->update([
            'default_rate_per_hour' => round($rate, 2),
        ]);
    }

    public function updateForemanDefaultRate(User $user, float $rate): void
    {
        $user->update([
            'default_rate_per_hour' => round($rate, 2),
        ]);
    }

    public function attendanceSummaryBetween(string $startDate, string $endDate): Collection
    {
        return Attendance::query()
            ->whereBetween('date', [$startDate, $endDate])
            ->selectRaw('worker_name, worker_role, COALESCE(SUM(hours), 0) as total_hours')
            ->groupBy('worker_name', 'worker_role')
            ->orderBy('worker_name')
            ->get();
    }

    public function findCutoffByRange(string $startDate, string $endDate): ?PayrollCutoff
    {
        return PayrollCutoff::query()
            ->whereDate('start_date', $startDate)
            ->whereDate('end_date', $endDate)
            ->first();
    }

    public function firstOrCreateCutoff(string $startDate, string $endDate, string $status = PayrollCutoff::STATUS_GENERATED): PayrollCutoff
    {
        return PayrollCutoff::query()->firstOrCreate(
            ['start_date' => $startDate, 'end_date' => $endDate],
            ['status' => $status]
        );
    }

    public function deletePayrollsByCutoffId(int $cutoffId): void
    {
        Payroll::query()->where('cutoff_id', $cutoffId)->delete();
    }

    public function createDeduction(Payroll $payroll, array $attributes): PayrollDeduction
    {
        return $payroll->deductionItems()->create($attributes);
    }

    public function updateDeduction(PayrollDeduction $payrollDeduction, array $attributes): void
    {
        $payrollDeduction->update($attributes);
    }

    public function deleteDeduction(PayrollDeduction $payrollDeduction): void
    {
        $payrollDeduction->delete();
    }

    public function loadPayrollFromDeduction(PayrollDeduction $payrollDeduction): Payroll
    {
        return $payrollDeduction->payroll()->firstOrFail();
    }

    public function sumDeductionAmount(Payroll $payroll): float
    {
        return (float) $payroll->deductionItems()->sum('amount');
    }

    public function payrollsByCutoffId(int $cutoffId): EloquentCollection
    {
        return Payroll::query()->where('cutoff_id', $cutoffId)->get();
    }

    public function payrollsForExportByCutoffId(int $cutoffId): EloquentCollection
    {
        return Payroll::query()
            ->with('deductionItems')
            ->where('cutoff_id', $cutoffId)
            ->orderBy('worker_name')
            ->get();
    }

    public function workerDefaultRateByName(string $workerName): ?float
    {
        $rate = Worker::query()
            ->whereRaw('LOWER(name) = ?', [Str::lower($workerName)])
            ->whereNotNull('default_rate_per_hour')
            ->where('default_rate_per_hour', '>', 0)
            ->orderByDesc('id')
            ->value('default_rate_per_hour');

        return $rate !== null ? (float) $rate : null;
    }

    public function foremanDefaultRateByName(string $workerName): ?float
    {
        $rate = User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->whereRaw('LOWER(fullname) = ?', [Str::lower($workerName)])
            ->whereNotNull('default_rate_per_hour')
            ->where('default_rate_per_hour', '>', 0)
            ->orderByDesc('id')
            ->value('default_rate_per_hour');

        return $rate !== null ? (float) $rate : null;
    }

    public function latestPayrollRateByName(string $workerName): ?float
    {
        $rate = Payroll::query()
            ->whereRaw('LOWER(worker_name) = ?', [Str::lower($workerName)])
            ->where('rate_per_hour', '>', 0)
            ->orderByDesc('id')
            ->value('rate_per_hour');

        return $rate !== null ? (float) $rate : null;
    }

    public function latestPayrollRateByRole(string $role): ?float
    {
        $rate = Payroll::query()
            ->where('role', $role)
            ->where('rate_per_hour', '>', 0)
            ->orderByDesc('id')
            ->value('rate_per_hour');

        return $rate !== null ? (float) $rate : null;
    }

    public function syncDefaultRateByWorkerName(string $workerName, float $rate): void
    {
        Worker::query()
            ->where('name', $workerName)
            ->update(['default_rate_per_hour' => $rate]);

        User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->where('fullname', $workerName)
            ->update(['default_rate_per_hour' => $rate]);
    }
}
