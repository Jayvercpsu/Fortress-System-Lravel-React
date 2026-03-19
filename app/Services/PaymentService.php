<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\Project;
use App\Models\User;
use App\Repositories\Contracts\PaymentRepositoryInterface;
use Illuminate\Http\Request;

class PaymentService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];
    private const MANAGE_ROLES = [User::ROLE_HEAD_ADMIN, User::ROLE_ADMIN, User::ROLE_HR];

    public function __construct(
        private readonly PaymentRepositoryInterface $paymentRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, self::MANAGE_ROLES, true), 403);
    }

    public function indexPayload(Request $request, Project $project): array
    {
        $this->paymentRepository->syncProjectPaymentSummary($project);
        $project->refresh();

        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        $paginator = $this->paymentRepository->paginateProjectPayments($project, $search, $perPage);

        $payments = collect($paginator->items())
            ->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'amount' => (float) $payment->amount,
                'date_paid' => optional($payment->date_paid)?->toDateString(),
                'reference' => $payment->reference,
                'note' => $payment->note,
                'created_at' => optional($payment->created_at)?->toDateTimeString(),
            ])
            ->values();

        return [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'contract_amount' => (float) $project->contract_amount,
                'total_client_payment' => (float) $project->total_client_payment,
                'remaining_balance' => (float) $project->remaining_balance,
                'last_paid_date' => optional($project->last_paid_date)?->toDateString(),
                'status' => $project->status ?? '',
                'phase' => $project->phase ?? '',
            ],
            'payments' => $payments,
            'paymentTable' => [
                'search' => $search,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }

    public function pageByRole(User $user): string
    {
        return $user->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Projects/Payments'
            : 'HR/ProjectPayments';
    }

    public function createPayment(Project $project, array $validated): void
    {
        $this->paymentRepository->createProjectPayment($project, $validated);
        $this->paymentRepository->syncProjectPaymentSummary($project);
    }

    public function deletePayment(Payment $payment): void
    {
        $project = $payment->project;
        $this->paymentRepository->deletePayment($payment);
        $this->paymentRepository->syncProjectPaymentSummary($project);
    }

    public function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }
}
