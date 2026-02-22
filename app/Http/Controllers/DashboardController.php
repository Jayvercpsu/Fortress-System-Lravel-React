<?php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Attendance;
use App\Models\MaterialRequest;
use App\Models\IssueReport;
use App\Models\Payroll;
use App\Models\WeeklyAccomplishment;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardController extends Controller {
    public function headAdmin() {
        $stats = [
            'total_users'     => User::where('role', '!=', 'head_admin')->count(),
            'total_foremen'   => User::where('role', 'foreman')->count(),
            'total_hr'        => User::where('role', 'hr')->count(),
            'total_admins'    => User::where('role', 'admin')->count(),
            'pending_materials' => MaterialRequest::where('status', 'pending')->count(),
            'open_issues'     => IssueReport::where('status', 'open')->count(),
            'payroll_pending' => Payroll::where('status', 'pending')->sum('net'),
        ];

        $recentSubmissions = [
            'materials' => MaterialRequest::with('foreman')->latest()->take(5)->get(),
            'issues'    => IssueReport::with('foreman')->latest()->take(5)->get(),
        ];

        return Inertia::render('HeadAdmin/Dashboard', compact('stats', 'recentSubmissions'));
    }

    public function admin() {
        $stats = [
            'pending_materials' => MaterialRequest::where('status', 'pending')->count(),
            'open_issues'       => IssueReport::where('status', 'open')->count(),
            'submissions_today' => Attendance::whereDate('created_at', today())->count(),
        ];
        return Inertia::render('Admin/Dashboard', compact('stats'));
    }

    public function hr() {
        $payrolls = Payroll::with('user')->latest()->take(20)->get();
        $totalPayable = Payroll::whereIn('status', ['pending', 'ready', 'approved'])->sum('net');
        return Inertia::render('HR/Dashboard', compact('payrolls', 'totalPayable'));
    }

    public function foreman() {
        $user = Auth::user();
        $attendances    = Attendance::where('foreman_id', $user->id)->latest()->take(20)->get();
        $accomplishments = WeeklyAccomplishment::where('foreman_id', $user->id)->latest()->take(20)->get();
        $materialRequests = MaterialRequest::where('foreman_id', $user->id)->latest()->take(10)->get();
        $issueReports   = IssueReport::where('foreman_id', $user->id)->latest()->take(10)->get();
        $deliveries     = \App\Models\DeliveryConfirmation::where('foreman_id', $user->id)->latest()->take(10)->get();

        return Inertia::render('Foreman/Dashboard', compact(
            'user', 'attendances', 'accomplishments', 'materialRequests', 'issueReports', 'deliveries'
        ));
    }
}
