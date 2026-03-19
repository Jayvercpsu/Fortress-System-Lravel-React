<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payments\StorePaymentRequest;
use App\Models\Payment;
use App\Models\Project;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PaymentController extends Controller
{
    public function __construct(
        private readonly PaymentService $paymentService
    ) {
    }

    public function index(Request $request, Project $project)
    {
        $this->paymentService->ensureAuthorized($request->user());
        $page = $this->paymentService->pageByRole($request->user());

        return Inertia::render($page, [
            ...$this->paymentService->indexPayload($request, $project),
        ]);
    }

    public function store(StorePaymentRequest $request, Project $project)
    {
        $this->paymentService->ensureAuthorized($request->user());
        $this->paymentService->createPayment($project, $request->validated());

        return redirect()
            ->route('payments.index', [
                'project' => $project->id,
                ...$this->paymentService->tableQueryParams($request),
            ])
            ->with('success', __('messages.payments.created'));
    }

    public function destroy(Request $request, Payment $payment)
    {
        $this->paymentService->ensureAuthorized($request->user());
        $project = $payment->project;
        $this->paymentService->deletePayment($payment);

        return redirect()
            ->route('payments.index', [
                'project' => $project->id,
                ...$this->paymentService->tableQueryParams($request),
            ])
            ->with('success', __('messages.payments.deleted'));
    }
}
