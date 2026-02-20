<?php

namespace App\Http\Controllers;

use App\Models\Payroll;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class PayrollController extends Controller
{
    public function index()
    {
        $payrolls = Payroll::with('user')->latest()->get();
        $totalPayable = Payroll::whereIn('status', ['pending', 'ready', 'approved'])->sum('net');

        return Inertia::render('HR/Payroll', compact('payrolls', 'totalPayable'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'worker_name'   => 'required|string',
            'role'          => 'required|string',
            'hours'         => 'required|numeric|min:0',
            'rate_per_hour' => 'required|numeric|min:0',
            'deductions'    => 'nullable|numeric|min:0',
            'week_start'    => 'required|date',
        ]);

        $gross = $request->hours * $request->rate_per_hour;
        $deductions = $request->deductions ?? 0;
        $net = $gross - $deductions;

        Payroll::create([
            'user_id'       => Auth::id(),
            'worker_name'   => $request->worker_name,
            'role'          => $request->role,
            'hours'         => $request->hours,
            'rate_per_hour' => $request->rate_per_hour,
            'gross'         => $gross,
            'deductions'    => $deductions,
            'net'           => $net,
            'week_start'    => $request->week_start,
        ]);

        return back()->with('success', 'Payroll entry added.');
    }

    public function updateStatus(Request $request, Payroll $payroll)
    {
        $request->validate([
            'status' => 'required|in:pending,ready,approved,paid'
        ]);

        $payroll->update([
            'status' => $request->status
        ]);

        return back()->with('success', 'Status updated.');
    }
}