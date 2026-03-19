<?php

namespace App\Http\Controllers;

use App\Http\Requests\Payrolls\ExportPayrollRequest;
use App\Http\Requests\Payrolls\GeneratePayrollFromAttendanceRequest;
use App\Http\Requests\Payrolls\MarkPayrollPaidRequest;
use App\Http\Requests\Payrolls\StorePayrollDeductionRequest;
use App\Http\Requests\Payrolls\StorePayrollRequest;
use App\Http\Requests\Payrolls\UpdateDefaultRateRequest;
use App\Http\Requests\Payrolls\UpdatePayrollDeductionRequest;
use App\Http\Requests\Payrolls\UpdatePayrollRequest;
use App\Http\Requests\Payrolls\UpdatePayrollStatusRequest;
use App\Models\Payroll;
use App\Models\PayrollDeduction;
use App\Models\User;
use App\Models\Worker;
use App\Services\PayrollService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class PayrollController extends Controller
{
    public function __construct(
        private readonly PayrollService $payrollService
    ) {
    }

    public function index()
    {
        return Inertia::render('HR/Payroll', $this->payrollService->indexPayload());
    }

    public function store(StorePayrollRequest $request)
    {
        $this->payrollService->store($request->validated(), (int) Auth::id());

        return back()->with('success', __('messages.payroll.entry_added'));
    }

    public function updateStatus(UpdatePayrollStatusRequest $request, Payroll $payroll)
    {
        $this->payrollService->updateStatus($payroll, (string) $request->validated('status'));

        return back()->with('success', __('messages.payroll.status_updated'));
    }

    public function update(UpdatePayrollRequest $request, Payroll $payroll)
    {
        $this->payrollService->updatePayroll($payroll, $request->validated());

        return back()->with('success', __('messages.payroll.entry_updated'));
    }

    public function run(Request $request)
    {
        return Inertia::render('HR/PayrollRun', $this->payrollService->runPayload($request));
    }

    public function workerRates(Request $request)
    {
        return Inertia::render('HR/WorkerRates', $this->payrollService->workerRatesPayload($request));
    }

    public function updateWorkerRate(UpdateDefaultRateRequest $request, Worker $worker)
    {
        $this->payrollService->updateWorkerRate($worker, (float) $request->validated('default_rate_per_hour'));

        return redirect()
            ->route('payroll.worker_rates', $this->payrollService->tableQueryParams($request))
            ->with('success', __('messages.payroll.worker_rate_updated'));
    }

    public function updateForemanRate(UpdateDefaultRateRequest $request, User $user)
    {
        $this->payrollService->updateForemanRate($user, (float) $request->validated('default_rate_per_hour'));

        return redirect()
            ->route('payroll.worker_rates', $this->payrollService->tableQueryParams($request))
            ->with('success', __('messages.payroll.foreman_rate_updated'));
    }

    public function generateFromAttendance(GeneratePayrollFromAttendanceRequest $request)
    {
        $cutoff = $this->payrollService->generateFromAttendance($request->validated(), (int) Auth::id());

        return redirect()->route('payroll.run', $this->payrollService->runGenerateQueryParams($request, $cutoff));
    }

    public function addDeduction(StorePayrollDeductionRequest $request, Payroll $payroll)
    {
        $this->payrollService->addDeduction($payroll, $request->validated());

        return redirect()->route('payroll.run', $this->payrollService->payrollRunQueryParams($request, $payroll));
    }

    public function updateDeduction(UpdatePayrollDeductionRequest $request, PayrollDeduction $payrollDeduction)
    {
        $payroll = $this->payrollService->updateDeduction($payrollDeduction, $request->validated());

        return redirect()->route('payroll.run', $this->payrollService->payrollRunQueryParams($request, $payroll));
    }

    public function destroyDeduction(Request $request, PayrollDeduction $payrollDeduction)
    {
        $payroll = $this->payrollService->destroyDeduction($payrollDeduction);

        return redirect()->route('payroll.run', $this->payrollService->payrollRunQueryParams($request, $payroll));
    }

    public function markPaid(MarkPayrollPaidRequest $request)
    {
        $cutoff = $this->payrollService->markPaid($request->validated(), (int) Auth::id());

        return redirect()->route('payroll.run', $this->payrollService->markPaidQueryParams($request, $cutoff));
    }

    public function export(ExportPayrollRequest $request)
    {
        return $this->payrollService->exportResponse((int) $request->validated('cutoff_id'));
    }
}
