<?php
namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Attendance;
use App\Models\MaterialRequest;
use App\Models\IssueReport;
use App\Models\Payroll;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\WeeklyAccomplishment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardController extends Controller {
    private const PH_TIMEZONE = 'Asia/Manila';
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
        $projects = Project::query()
            ->orderBy('name')
            ->get(['id', 'name', 'client', 'contract_amount', 'total_client_payment', 'remaining_balance'])
            ->map(fn (Project $project) => [
                'id' => $project->id,
                'name' => $project->name,
                'client' => $project->client,
                'contract_amount' => (float) $project->contract_amount,
                'total_client_payment' => (float) $project->total_client_payment,
                'remaining_balance' => (float) $project->remaining_balance,
            ])
            ->values();

        return Inertia::render('HR/Dashboard', compact('payrolls', 'totalPayable', 'projects'));
    }

    public function foreman() {
        $user = Auth::user();
        $attendances    = Attendance::where('foreman_id', $user->id)->latest()->take(20)->get();
        $accomplishments = WeeklyAccomplishment::where('foreman_id', $user->id)->latest()->take(20)->get();
        $materialRequests = MaterialRequest::where('foreman_id', $user->id)->latest()->take(10)->get();
        $issueReports   = IssueReport::where('foreman_id', $user->id)->latest()->take(10)->get();
        $deliveries     = \App\Models\DeliveryConfirmation::where('foreman_id', $user->id)->latest()->take(10)->get();
        $progressPhotos = ProgressPhoto::query()
            ->with('project:id,name')
            ->where('foreman_id', $user->id)
            ->latest()
            ->take(10)
            ->get()
            ->map(fn (ProgressPhoto $photo) => [
                'id' => $photo->id,
                'photo_path' => $photo->photo_path,
                'caption' => $photo->caption,
                'project_name' => $photo->project?->name ?? 'Unassigned',
                'created_at' => optional($photo->created_at)?->toDateTimeString(),
            ])
            ->values();
        $projectScopes = ProjectScope::query()
            ->orderBy('scope_name')
            ->get(['id', 'project_id', 'scope_name'])
            ->map(fn (ProjectScope $scope) => [
                'id' => $scope->id,
                'project_id' => $scope->project_id,
                'scope_name' => $scope->scope_name,
            ])
            ->values();
        $projects = Project::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Project $project) => ['id' => $project->id, 'name' => $project->name])
            ->values();

        $foremanAttendanceToday = null;
        $foremanName = trim((string) ($user->fullname ?? ''));
        if ($foremanName !== '') {
            $phToday = Carbon::now(self::PH_TIMEZONE)->toDateString();
            $selfLog = Attendance::query()
                ->with('project:id,name')
                ->where('foreman_id', $user->id)
                ->whereDate('date', $phToday)
                ->where('worker_role', 'Foreman')
                ->where('worker_name', $foremanName)
                ->orderByDesc('id')
                ->first();

            if ($selfLog) {
                $foremanAttendanceToday = [
                    'id' => $selfLog->id,
                    'date' => optional($selfLog->date)?->toDateString(),
                    'project_id' => $selfLog->project_id,
                    'project_name' => $selfLog->project?->name,
                    'time_in' => $selfLog->time_in,
                    'time_out' => $selfLog->time_out,
                    'hours' => (float) ($selfLog->hours ?? 0),
                ];
            }
        }

        return Inertia::render('Foreman/Dashboard', compact(
            'user',
            'attendances',
            'accomplishments',
            'materialRequests',
            'issueReports',
            'deliveries',
            'projects',
            'foremanAttendanceToday',
            'progressPhotos',
            'projectScopes'
        ));
    }
}
