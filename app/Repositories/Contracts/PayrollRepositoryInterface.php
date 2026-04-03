<?php

namespace App\Repositories\Contracts;

use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\PayrollDeduction;
use App\Models\Project;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

interface PayrollRepositoryInterface
{
    public function latestPayrollsWithUser(?string $group = null, ?int $projectId = null): EloquentCollection;

    public function totalPayableByStatuses(array $statuses, ?string $group = null, ?int $projectId = null): float;

    public function latestPayrollWorkers(?int $projectId = null): EloquentCollection;

    public function workersForOptions(): EloquentCollection;

    public function foremenForOptions(): EloquentCollection;

    public function createPayroll(array $attributes): Payroll;

    public function updatePayroll(Payroll $payroll, array $attributes): void;

    public function runPayrollPaginator(?int $cutoffId, string $search, int $perPage, ?string $group = null, ?int $projectId = null): LengthAwarePaginator;

    public function findCutoffById(int $id): ?PayrollCutoff;

    public function latestCutoff(): ?PayrollCutoff;

    public function cutoffOptionsRows(?string $group = null, ?int $projectId = null, int $limit = 20): EloquentCollection;

    public function payrollAggregatesByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): array;

    public function paidPayrollCountByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): int;

    public function workersWithForeman(?int $projectId = null): EloquentCollection;

    public function foremenForRates(): EloquentCollection;
    public function foremenForProject(int $projectId): EloquentCollection;

    public function staffUsersForRates(): EloquentCollection;

    public function updateWorkerDefaultRate(Worker $worker, float $rate): void;

    public function updateForemanDefaultRate(User $user, float $rate): void;

    public function attendanceSummaryBetween(string $startDate, string $endDate, ?string $group = null, ?int $projectId = null): Collection;

    public function findCutoffByRange(string $startDate, string $endDate): ?PayrollCutoff;

    public function firstOrCreateCutoff(string $startDate, string $endDate, string $status = PayrollCutoff::STATUS_GENERATED): PayrollCutoff;

    public function deletePayrollsByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): void;

    public function createDeduction(Payroll $payroll, array $attributes): PayrollDeduction;

    public function updateDeduction(PayrollDeduction $payrollDeduction, array $attributes): void;

    public function deleteDeduction(PayrollDeduction $payrollDeduction): void;

    public function loadPayrollFromDeduction(PayrollDeduction $payrollDeduction): Payroll;

    public function sumDeductionAmount(Payroll $payroll): float;

    public function sumIncentiveAmount(Payroll $payroll): float;

    public function payrollsByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): EloquentCollection;

    public function payrollsForExportByCutoffId(int $cutoffId, ?string $group = null, ?int $projectId = null): EloquentCollection;

    public function projectOptionsRows(): EloquentCollection;

    public function projectById(int $id): ?Project;

    public function workerDefaultRateByName(string $workerName): ?float;

    public function foremanDefaultRateByName(string $workerName): ?float;

    public function staffDefaultRateByName(string $workerName): ?float;

    public function latestPayrollRateByName(string $workerName): ?float;

    public function latestPayrollRateByRole(string $role): ?float;

    public function syncDefaultRateByWorkerName(string $workerName, float $rate): void;
}
