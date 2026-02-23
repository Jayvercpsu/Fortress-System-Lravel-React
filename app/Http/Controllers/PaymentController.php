<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Project;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PaymentController extends Controller
{
    public function index(Request $request, Project $project)
    {
        $this->authorizeRole($request);

        $this->syncProjectPaymentSummary($project);
        $project->refresh();

        $search = trim((string) $request->query('search', ''));
        $allowedPerPage = [5, 10, 25, 50];
        $perPage = (int) $request->query('per_page', 10);
        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $query = $project->payments();
        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('reference', 'like', "%{$search}%")
                    ->orWhere('note', 'like', "%{$search}%")
                    ->orWhere('date_paid', 'like', "%{$search}%");
            });
        }

        $paginator = $query
            ->orderByDesc('date_paid')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

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

        $page = $request->user()->role === 'head_admin'
            ? 'HeadAdmin/Projects/Payments'
            : 'HR/ProjectPayments';

        return Inertia::render($page, [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'contract_amount' => (float) $project->contract_amount,
                'total_client_payment' => (float) $project->total_client_payment,
                'remaining_balance' => (float) $project->remaining_balance,
                'last_paid_date' => optional($project->last_paid_date)?->toDateString(),
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
        ]);
    }

    public function store(Request $request, Project $project)
    {
        $this->authorizeRole($request);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'date_paid' => ['required', 'date'],
            'reference' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $project->payments()->create($validated);
        $this->syncProjectPaymentSummary($project);

        return redirect()
            ->route('payments.index', [
                'project' => $project->id,
                ...$this->tableQueryParams($request),
            ])
            ->with('success', 'Payment saved.');
    }

    public function destroy(Request $request, Payment $payment)
    {
        $this->authorizeRole($request);

        $project = $payment->project;
        $payment->delete();
        $this->syncProjectPaymentSummary($project);

        return redirect()
            ->route('payments.index', [
                'project' => $project->id,
                ...$this->tableQueryParams($request),
            ])
            ->with('success', 'Payment deleted.');
    }

    private function authorizeRole(Request $request): void
    {
        abort_unless(in_array($request->user()->role, ['head_admin', 'hr'], true), 403);
    }

    private function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function syncProjectPaymentSummary(Project $project): void
    {
        $totalClientPayment = (float) $project->payments()->sum('amount');
        $lastPaidDate = $project->payments()->max('date_paid');
        $contractAmount = (float) $project->contract_amount;
        $remainingBalance = $contractAmount - $totalClientPayment;

        $project->update([
            'total_client_payment' => $totalClientPayment,
            'remaining_balance' => $remainingBalance,
            'last_paid_date' => $lastPaidDate,
        ]);
    }
}
