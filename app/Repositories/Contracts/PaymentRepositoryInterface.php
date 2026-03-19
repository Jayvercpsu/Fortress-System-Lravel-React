<?php

namespace App\Repositories\Contracts;

use App\Models\Payment;
use App\Models\Project;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface PaymentRepositoryInterface
{
    public function paginateProjectPayments(Project $project, string $search, int $perPage): LengthAwarePaginator;

    public function createProjectPayment(Project $project, array $attributes): void;

    public function deletePayment(Payment $payment): void;

    public function syncProjectPaymentSummary(Project $project): void;
}
