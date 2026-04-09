<?php

namespace App\Repositories;

use App\Models\Payment;
use App\Models\Project;
use App\Repositories\Contracts\PaymentRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class PaymentRepository implements PaymentRepositoryInterface
{
    public function paginateProjectPayments(Project $project, string $search, int $perPage): LengthAwarePaginator
    {
        $query = $project->payments();

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhere('note', 'like', "%{$search}%")
                    ->orWhere('date_paid', 'like', "%{$search}%");
            });
        }

        return $query
            ->orderByDesc('date_paid')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function createProjectPayment(Project $project, array $attributes): void
    {
        $project->payments()->create($attributes);
    }

    public function deletePayment(Payment $payment): void
    {
        $payment->delete();
    }

    public function syncProjectPaymentSummary(Project $project): void
    {
        $lastPaidDate = $project->payments()->max('date_paid');

        $project->update([
            'last_paid_date' => $lastPaidDate,
        ]);
    }
}
