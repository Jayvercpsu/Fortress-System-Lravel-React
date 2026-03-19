<?php

namespace App\Repositories\Contracts;

use Illuminate\Support\Collection;

interface ReportRepositoryInterface
{
    public function nonDesignProjects(): Collection;

    public function expenseTotalsByProject(): Collection;

    public function attendanceGroupedByWorker(): Collection;

    public function payrollRowsWithCutoff(): Collection;

    public function scopeAggregatesByProject(): Collection;
}
