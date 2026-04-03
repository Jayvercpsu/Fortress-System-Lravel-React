<?php

namespace App\Repositories;

use App\Models\Attendance;
use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\PayrollDeduction;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use App\Models\Worker;
use App\Repositories\Contracts\PayrollRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class PayrollRepository implements PayrollRepositoryInterface
{
    public function latestPayrollsWithUser(?string $group = null, ?int $projectId = null): EloquentCollection
    {
        $query = Payroll::query()
            ->with(['user', 'project:id,name,client,status,phase'])
            ->latest();

        $this->applyRoleGroupFilter($query, $group, 'role');
        $this->applyProjectFilter($query, $projectId);

        return $query->get();
    }

    public function totalPayableByStatuses(array $statuses, ?string $group = null, ?int $projectId = null): float
    {
        $query = Payroll::query()->whereIn('status', $statuses);
        $this->applyRoleGroupFilter($query, $group, 'role');
        $this->applyProjectFilter($query, $projectId);

        return (float) $query->sum('net');
    }

    public function latestPayrollWorkers(?int $projectId = null): EloquentCollection
    {
        return Payroll::query()
            ->when($projectId !== null, fn ($query) => $query->where('project_id', $projectId))
            ->whereNotNull('worker_name')
            ->where('worker_name', '!=', '')
            ->orderByDesc('id')
            ->get(['worker_name', 'role', 'rate_per_hour', 'project_id']);
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

    public function runPayrollPaginator(?int $cutoffId, string $search, int $perPage, ?string $group = null, ?int $projectId = null): LengthAwarePaginator
    {
        $query = Payroll::query()
            ->with(['deductionItems', 'releasedBy:id,fullname', 'project:id,name,client,status,phase'])
            ->when($cutoffId, fn ($q) => $q->where('cutoff_id', $cutoffId), fn ($q) => $q->whereRaw('1=0'))
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($sub) use ($search) {
                    $sub
                        ->where('worker_name', 'like', "%{$search}%")
                        ->orWhere('role', 'like', "%{$search}%")
                        ->orWhere('status', 'like', "%{$search}%")
                        ->orWhereHas('project', function ($projectQuery) use ($search) {
                            $projectQuery
                                ->where('name', 'like', "%{$search}%")
                                ->orWhere('client', 'like', "%{$search}%");
                        });
                });
            });

        $this->applyRoleGroupFilter($query, $group, 'role');
        $this->applyProjectFilter($query, $projectId);

        return $query
            ->orderByRaw('project_id is null')
            ->orderBy('project_id')
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

    public function cutoffOptionsRows(?string $group = null, ?int $projectId = null, int $limit = 20): EloquentCollection
    {
        $cutoffIds = Payroll::query()
            ->select('cutoff_id')
            ->whereNotNull('cutoff_id')
            ->when($projectId !== null, fn ($query) => $query->where('project_id', $projectId));
        $this->applyRoleGroupFilter($cutoffIds, $group, 'role');

        return PayrollCutoff::query()
            ->whereIn('id', $cutoffIds)
            ->orderByDesc('end_date')
            ->orderByDesc('id')
            ->take($limit)
            ->get();
    }

    public function payrollAggregatesByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): array
    {
        $payrolls = Payroll::query()->where('cutoff_id', $cutoffId);
        $this->applyRoleGroupFilter($payrolls, $group, 'role');
        $this->applyProjectFilter($payrolls, $projectId);

        return [
            'payroll_count' => (int) (clone $payrolls)->count(),
            'total_hours' => round((float) (clone $payrolls)->sum('hours'), 2),
            'total_gross' => round((float) (clone $payrolls)->sum('gross'), 2),
            'total_deductions' => round((float) (clone $payrolls)->sum('deductions'), 2),
            'total_net' => round((float) (clone $payrolls)->sum('net'), 2),
        ];
    }

    public function paidPayrollCountByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): int
    {
        $query = Payroll::query()
            ->where('cutoff_id', $cutoffId)
            ->where('status', Payroll::STATUS_PAID);

        $this->applyRoleGroupFilter($query, $group, 'role');
        $this->applyProjectFilter($query, $projectId);

        return $query->count();
    }

    public function workersWithForeman(?int $projectId = null): EloquentCollection
    {
        $query = Worker::query()
            ->with('foreman:id,fullname')
            ->orderBy('name');

        if ($projectId !== null) {
            $query->where('project_id', $projectId);
        }

        return $query->get();
    }

    public function foremenForRates(): EloquentCollection
    {
        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname', 'email', 'default_rate_per_hour', 'updated_at']);
    }

    public function foremenForProject(int $projectId): EloquentCollection
    {
        return User::query()
            ->select(['users.id', 'users.fullname', 'users.default_rate_per_hour'])
            ->join('project_assignments', 'project_assignments.user_id', '=', 'users.id')
            ->where('project_assignments.project_id', $projectId)
            ->where('project_assignments.role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->whereNull('project_assignments.deleted_at')
            ->where('users.role', User::ROLE_FOREMAN)
            ->orderBy('users.fullname')
            ->get();
    }

    public function staffUsersForRates(): EloquentCollection
    {
        return User::query()
            ->whereIn('role', [User::ROLE_HR, User::ROLE_ADMIN, User::ROLE_DESIGNER])
            ->orderBy('fullname')
            ->get(['id', 'fullname', 'email', 'role', 'default_rate_per_hour', 'updated_at']);
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

    public function attendanceSummaryBetween(string $startDate, string $endDate, ?string $group = null, ?int $projectId = null): Collection
    {
        $query = Attendance::query()->whereBetween('date', [$startDate, $endDate]);
        if ($projectId !== null) {
            $query->where('project_id', $projectId);
        }
        $this->applyRoleGroupFilter($query, $group, 'worker_role');

        return $query
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

    public function deletePayrollsByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): void
    {
        $query = Payroll::query()->where('cutoff_id', $cutoffId);
        $this->applyRoleGroupFilter($query, $group, 'role');
        $this->applyProjectFilter($query, $projectId);
        $query->delete();
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
        return (float) $payroll->deductionItems()
            ->where('type', '!=', PayrollDeduction::TYPE_INCENTIVE)
            ->sum('amount');
    }

    public function sumIncentiveAmount(Payroll $payroll): float
    {
        return (float) $payroll->deductionItems()
            ->where('type', PayrollDeduction::TYPE_INCENTIVE)
            ->sum('amount');
    }

    public function payrollsByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): EloquentCollection
    {
        $query = Payroll::query()->where('cutoff_id', $cutoffId);
        $this->applyRoleGroupFilter($query, $group, 'role');
        $this->applyProjectFilter($query, $projectId);

        return $query->get();
    }

    public function payrollsForExportByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): EloquentCollection
    {
        $query = Payroll::query()
            ->with(['deductionItems', 'project:id,name,client'])
            ->where('cutoff_id', $cutoffId);

        $this->applyRoleGroupFilter($query, $group, 'role');
        $this->applyProjectFilter($query, $projectId);

        return $query->orderBy('worker_name')->get();
    }

    public function projectOptionsRows(): EloquentCollection
    {
        return Project::query()
            ->whereRaw('LOWER(COALESCE(status, \'\')) not in (?, ?)', ['cancelled', 'canceled'])
            ->orderBy('name')
            ->get(['id', 'name', 'client', 'phase', 'status', 'contract_amount']);
    }

    public function projectById(int $id): ?Project
    {
        return Project::query()->find($id);
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

    public function staffDefaultRateByName(string $workerName): ?float
    {
        $rate = User::query()
            ->whereIn('role', [User::ROLE_HR, User::ROLE_ADMIN, User::ROLE_DESIGNER])
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

    private function applyProjectFilter($query, ?int $projectId): void
    {
        if ($projectId === null || $projectId <= 0) {
            return;
        }

        $query->where('project_id', $projectId);
    }

    private function applyRoleGroupFilter($query, ?string $group, string $roleColumn = 'role'): void
    {
        $normalizedGroup = $group ? strtolower(trim($group)) : null;
        if (!in_array($normalizedGroup, ['workers', 'staff'], true)) {
            return;
        }

        $roleField = "LOWER(COALESCE({$roleColumn}, ''))";
        $staffRoleMatchers = [
            'hr',
            'human resources',
            'admin',
            'administrator',
            'designer',
        ];

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
}
