<?php

namespace App\Repositories\Contracts;

use App\Models\Payroll;
use App\Models\PayrollCutoff;
use App\Models\PayrollDeduction;
use App\Models\User;
use App\Models\Worker;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

interface PayrollRepositoryInterface
{
    public function latestPayrollsWithUser(): EloquentCollection;

    public function totalPayableByStatuses(array $statuses): float;

    public function latestPayrollWorkers(): EloquentCollection;

    public function workersForOptions(): EloquentCollection;

    public function foremenForOptions(): EloquentCollection;

    public function createPayroll(array $attributes): Payroll;

    public function updatePayroll(Payroll $payroll, array $attributes): void;

    public function runPayrollPaginator(?int $cutoffId, string $search, int $perPage): LengthAwarePaginator;

    public function findCutoffById(int $id): ?PayrollCutoff;

    public function latestCutoff(): ?PayrollCutoff;

    public function cutoffOptionsRows(int $limit = 20): EloquentCollection;

    public function payrollAggregatesByCutoffId(int $cutoffId): array;

    public function paidPayrollCountByCutoffId(int $cutoffId): int;

    public function workersWithForeman(): EloquentCollection;

    public function foremenForRates(): EloquentCollection;

    public function updateWorkerDefaultRate(Worker $worker, float $rate): void;

    public function updateForemanDefaultRate(User $user, float $rate): void;

    public function attendanceSummaryBetween(string $startDate, string $endDate): Collection;

    public function findCutoffByRange(string $startDate, string $endDate): ?PayrollCutoff;

    public function firstOrCreateCutoff(string $startDate, string $endDate, string $status = PayrollCutoff::STATUS_GENERATED): PayrollCutoff;

    public function deletePayrollsByCutoffId(int $cutoffId): void;

    public function createDeduction(Payroll $payroll, array $attributes): PayrollDeduction;

    public function updateDeduction(PayrollDeduction $payrollDeduction, array $attributes): void;

    public function deleteDeduction(PayrollDeduction $payrollDeduction): void;

    public function loadPayrollFromDeduction(PayrollDeduction $payrollDeduction): Payroll;

    public function sumDeductionAmount(Payroll $payroll): float;

    public function payrollsByCutoffId(int $cutoffId): EloquentCollection;

    public function payrollsForExportByCutoffId(int $cutoffId): EloquentCollection;

    public function workerDefaultRateByName(string $workerName): ?float;

    public function foremanDefaultRateByName(string $workerName): ?float;

    public function latestPayrollRateByName(string $workerName): ?float;

    public function latestPayrollRateByRole(string $role): ?float;

    public function syncDefaultRateByWorkerName(string $workerName, float $rate): void;
}
