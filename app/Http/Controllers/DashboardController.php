<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\Expense;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\Payroll;
use App\Models\ProgressPhoto;
use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DashboardController extends Controller
{
    private const PH_TIMEZONE = 'Asia/Manila';

    public function headAdmin(Request $request)
    {
        $projectKpis = $this->projectKpis();
        $payrollPaymentKpis = $this->payrollAndPaymentKpis();
        $companyFinancialSummary = $this->companyFinancialSummary((float) ($projectKpis['financial_totals']['contract_sum'] ?? 0));

        $stats = [
            'total_users' => User::where('role', '!=', 'head_admin')->count(),
            'total_foremen' => User::where('role', 'foreman')->count(),
            'total_hr' => User::where('role', 'hr')->count(),
            'total_admins' => User::where('role', 'admin')->count(),
            'pending_materials' => MaterialRequest::where('status', 'pending')->count(),
            'open_issues' => IssueReport::where('status', 'open')->count(),
            'payroll_pending' => $payrollPaymentKpis['payroll_payable'],
        ];

        $kpis = array_merge($projectKpis, $payrollPaymentKpis, [
            'users' => [
                'total_users' => $stats['total_users'],
                'total_foremen' => $stats['total_foremen'],
                'total_hr' => $stats['total_hr'],
                'total_admins' => $stats['total_admins'],
            ],
            'operations' => [
                'pending_materials' => $stats['pending_materials'],
                'open_issues' => $stats['open_issues'],
            ],
            'company_financial_summary' => $companyFinancialSummary,
        ]);

        $materialsPager = MaterialRequest::query()
            ->with('foreman:id,fullname')
            ->latest()
            ->paginate(5, ['*'], 'ha_materials_page')
            ->withQueryString();
        $materialsPager->setCollection(
            $materialsPager->getCollection()->map(fn (MaterialRequest $row) => [
                'id' => $row->id,
                'material_name' => $row->material_name,
                'quantity' => $row->quantity,
                'unit' => $row->unit,
                'status' => $row->status,
                'foreman' => ['fullname' => $row->foreman?->fullname],
            ])
        );

        $issuesPager = IssueReport::query()
            ->with('foreman:id,fullname')
            ->latest()
            ->paginate(5, ['*'], 'ha_issues_page')
            ->withQueryString();
        $issuesPager->setCollection(
            $issuesPager->getCollection()->map(fn (IssueReport $row) => [
                'id' => $row->id,
                'issue_title' => $row->issue_title,
                'severity' => $row->severity,
                'status' => $row->status,
                'foreman' => ['fullname' => $row->foreman?->fullname],
            ])
        );

        $recentSubmissions = [
            'materials' => $materialsPager,
            'issues' => $issuesPager,
        ];

        $recentPayrollsPager = Payroll::query()
            ->latest()
            ->paginate(8, ['*'], 'ha_payrolls_page')
            ->withQueryString();
        $recentPayrollsPager->setCollection(
            $recentPayrollsPager->getCollection()
                ->map(fn (Payroll $payroll) => [
                    'id' => $payroll->id,
                    'worker_name' => $payroll->worker_name,
                    'role' => $payroll->role,
                    'net' => (float) $payroll->net,
                    'status' => $payroll->status,
                    'week_start' => optional($payroll->week_start)?->toDateString(),
                ])
                ->values()
        );

        $recentProjectsPager = $this->paginateCollection(
            collect($projectKpis['projects'] ?? []),
            8,
            'ha_projects_page',
            $request
        );

        return Inertia::render('HeadAdmin/Dashboard', [
            'stats' => $stats,
            'kpis' => $kpis,
            'recentSubmissions' => $recentSubmissions,
            'recentPayrollsPager' => $recentPayrollsPager,
            'recentProjectsPager' => $recentProjectsPager,
        ]);
    }

    public function admin(Request $request)
    {
        $projectKpis = $this->projectKpis();
        $companyFinancialSummary = $this->companyFinancialSummary((float) ($projectKpis['financial_totals']['contract_sum'] ?? 0));

        // Intentionally exclude payroll-related figures from admin payload.
        $kpis = [
            'project_counts' => $projectKpis['project_counts'],
            'financial_totals' => $projectKpis['financial_totals'],
            'company_progress_percent' => $projectKpis['company_progress_percent'],
            'projects' => $projectKpis['projects'],
            'company_financial_summary' => $companyFinancialSummary,
        ];

        $projectSnapshotPager = $this->paginateCollection(
            collect($projectKpis['projects'] ?? []),
            10,
            'admin_projects_page',
            $request
        );

        return Inertia::render('Admin/Dashboard', compact('kpis', 'projectSnapshotPager'));
    }

    public function hr(Request $request)
    {
        $payrolls = Payroll::with('user')->latest()->take(20)->get();
        $totalPayable = (float) Payroll::whereIn('status', ['pending', 'ready', 'approved'])->sum('net');
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

        $projectPaymentsPager = Project::query()
            ->orderBy('name')
            ->paginate(10, ['id', 'name', 'client', 'contract_amount', 'total_client_payment', 'remaining_balance'], 'hr_projects_page')
            ->withQueryString();
        $projectPaymentsPager->setCollection(
            $projectPaymentsPager->getCollection()->map(fn (Project $project) => [
                'id' => $project->id,
                'name' => $project->name,
                'client' => $project->client,
                'contract_amount' => (float) $project->contract_amount,
                'total_client_payment' => (float) $project->total_client_payment,
                'remaining_balance' => (float) $project->remaining_balance,
            ])->values()
        );

        $recentPayrollsPager = Payroll::query()
            ->latest()
            ->paginate(10, ['*'], 'hr_payrolls_page')
            ->withQueryString();
        $recentPayrollsPager->setCollection(
            $recentPayrollsPager->getCollection()->map(fn (Payroll $row) => [
                'id' => $row->id,
                'worker_name' => $row->worker_name,
                'role' => $row->role,
                'hours' => (float) ($row->hours ?? 0),
                'rate_per_hour' => (float) ($row->rate_per_hour ?? 0),
                'gross' => (float) ($row->gross ?? 0),
                'net' => (float) ($row->net ?? 0),
                'status' => $row->status,
            ])->values()
        );

        $kpis = $this->payrollAndPaymentKpis();
        $kpis['company_financial_summary'] = $this->companyFinancialSummary((float) ($kpis['payment_totals']['contract_sum'] ?? 0));

        return Inertia::render('HR/Dashboard', compact('payrolls', 'totalPayable', 'projects', 'kpis', 'projectPaymentsPager', 'recentPayrollsPager'));
    }

    public function foreman(Request $request)
    {
        $user = Auth::user();
        $assignedProjectIds = $this->resolveForemanAssignedProjectIds($user);
        $assignedProjects = $this->foremanAssignedProjectsPayload($user, $assignedProjectIds);
        $assignedProjectsPager = $this->paginateCollection(
            collect($assignedProjects),
            5,
            'foreman_assigned_projects_page',
            $request
        );

        $attendances = Attendance::where('foreman_id', $user->id)->latest()->take(20)->get();
        $accomplishments = WeeklyAccomplishment::where('foreman_id', $user->id)->latest()->take(20)->get();
        $materialRequests = MaterialRequest::where('foreman_id', $user->id)->latest()->take(10)->get();
        $issueReports = IssueReport::where('foreman_id', $user->id)->latest()->take(10)->get();
        $deliveries = DeliveryConfirmation::query()
            ->with('project:id,name')
            ->where('foreman_id', $user->id)
            ->latest()
            ->take(10)
            ->get()
            ->map(fn (DeliveryConfirmation $delivery) => [
                'id' => $delivery->id,
                'project_id' => $delivery->project_id,
                'project_name' => $delivery->project?->name,
                'item_delivered' => $delivery->item_delivered,
                'quantity' => $delivery->quantity,
                'delivery_date' => $delivery->delivery_date ? (string) $delivery->delivery_date : null,
                'supplier' => $delivery->supplier,
                'status' => $delivery->status,
                'photo_path' => $delivery->photo_path,
                'created_at' => optional($delivery->created_at)?->toDateTimeString(),
            ])
            ->values();

        $materialRequestsPager = MaterialRequest::query()
            ->where('foreman_id', $user->id)
            ->latest()
            ->paginate(5, ['*'], 'foreman_dashboard_materials_page')
            ->withQueryString();
        $materialRequestsPager->setCollection(
            $materialRequestsPager->getCollection()->map(fn (MaterialRequest $row) => [
                'id' => $row->id,
                'material_name' => $row->material_name,
                'quantity' => $row->quantity,
                'unit' => $row->unit,
                'status' => $row->status,
                'photo_path' => $row->photo_path,
            ])->values()
        );

        $issueReportsPager = IssueReport::query()
            ->where('foreman_id', $user->id)
            ->latest()
            ->paginate(5, ['*'], 'foreman_dashboard_issues_page')
            ->withQueryString();
        $issueReportsPager->setCollection(
            $issueReportsPager->getCollection()->map(fn (IssueReport $row) => [
                'id' => $row->id,
                'issue_title' => $row->issue_title,
                'severity' => $row->severity,
                'status' => $row->status,
                'photo_path' => $row->photo_path,
            ])->values()
        );

        $deliveriesPager = DeliveryConfirmation::query()
            ->with('project:id,name')
            ->where('foreman_id', $user->id)
            ->latest()
            ->paginate(5, ['*'], 'foreman_dashboard_deliveries_page')
            ->withQueryString();
        $deliveriesPager->setCollection(
            $deliveriesPager->getCollection()->map(fn (DeliveryConfirmation $delivery) => [
                'id' => $delivery->id,
                'project_id' => $delivery->project_id,
                'project_name' => $delivery->project?->name,
                'item_delivered' => $delivery->item_delivered,
                'quantity' => $delivery->quantity,
                'delivery_date' => $delivery->delivery_date ? (string) $delivery->delivery_date : null,
                'supplier' => $delivery->supplier,
                'status' => $delivery->status,
                'photo_path' => $delivery->photo_path,
                'created_at' => optional($delivery->created_at)?->toDateTimeString(),
            ])->values()
        );

        $weeklyProjectId = trim((string) $request->query('foreman_weekly_project_id', ''));
        $weeklyProjectWeek = trim((string) $request->query('foreman_weekly_project_week', ''));

        $weeklyAccomplishmentsByProjectPager = WeeklyAccomplishment::query()
            ->with('project:id,name')
            ->where('foreman_id', $user->id)
            ->when(
                $weeklyProjectId !== '',
                fn ($query) => $query->where('project_id', (int) $weeklyProjectId)
            )
            ->selectRaw('
                project_id,
                COUNT(*) as scope_entries,
                COUNT(DISTINCT week_start) as submitted_weeks,
                AVG(percent_completed) as avg_percent_completed,
                MAX(week_start) as latest_week_start,
                MAX(created_at) as last_submitted_at
            ')
            ->groupBy('project_id')
            ->when(
                $weeklyProjectWeek !== '',
                fn ($query) => $query->havingRaw('MAX(week_start) = ?', [$weeklyProjectWeek])
            )
            ->orderByDesc('last_submitted_at')
            ->paginate(6, ['*'], 'foreman_dashboard_weekly_projects_page')
            ->withQueryString();
        $weeklyAccomplishmentsByProjectPager->setCollection(
            $weeklyAccomplishmentsByProjectPager->getCollection()->map(function (WeeklyAccomplishment $row) use ($user) {
                $lastSubmittedAt = $row->last_submitted_at
                    ? Carbon::parse((string) $row->last_submitted_at)
                        ->setTimezone(self::PH_TIMEZONE)
                        ->toDateTimeString()
                    : null;
                $latestWeekStart = $row->latest_week_start ? (string) $row->latest_week_start : null;
                $latestScopeEntries = collect();
                $scopePhotoCountsByScope = collect();

                if ($row->project_id !== null) {
                    $scopePhotoCountsByScope = ProjectScope::query()
                        ->where('project_id', $row->project_id)
                        ->withCount('photos')
                        ->get(['scope_name'])
                        ->filter(fn (ProjectScope $scope) => trim((string) ($scope->scope_name ?? '')) !== '')
                        ->mapWithKeys(fn (ProjectScope $scope) => [
                            Str::lower(trim((string) $scope->scope_name)) => (int) ($scope->photos_count ?? 0),
                        ]);
                }

                if ($latestWeekStart !== null) {
                    $latestScopeEntries = WeeklyAccomplishment::query()
                        ->where('foreman_id', $user->id)
                        ->whereDate('week_start', $latestWeekStart)
                        ->when(
                            $row->project_id === null,
                            fn ($query) => $query->whereNull('project_id'),
                            fn ($query) => $query->where('project_id', $row->project_id)
                        )
                        ->orderBy('scope_of_work')
                        ->get(['scope_of_work', 'percent_completed'])
                        ->map(fn (WeeklyAccomplishment $entry) => [
                            'scope_of_work' => $entry->scope_of_work,
                            'percent_completed' => round((float) ($entry->percent_completed ?? 0), 1),
                            'scope_photo_count' => (int) ($scopePhotoCountsByScope->get(
                                Str::lower(trim((string) ($entry->scope_of_work ?? ''))),
                                0
                            ) ?? 0),
                        ])
                        ->values();
                }

                return [
                    'project_id' => $row->project_id,
                    'project_name' => $row->project?->name ?? 'Unassigned',
                    'scope_entries' => (int) ($row->scope_entries ?? 0),
                    'submitted_weeks' => (int) ($row->submitted_weeks ?? 0),
                    'avg_percent_completed' => round((float) ($row->avg_percent_completed ?? 0), 1),
                    'latest_week_start' => $latestWeekStart,
                    'last_submitted_at' => $lastSubmittedAt,
                    'latest_scope_entries' => $latestScopeEntries,
                ];
            })->values()
        );

        $progressPhotos = ProgressPhoto::query()
            ->with('project:id,name')
            ->where('foreman_id', $user->id)
            ->when(
                $assignedProjectIds->isNotEmpty(),
                fn ($query) => $query->where(function ($inner) use ($assignedProjectIds) {
                    $inner->whereNull('project_id')->orWhereIn('project_id', $assignedProjectIds->all());
                })
            )
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
            ->when(
                $assignedProjectIds->isNotEmpty(),
                fn ($query) => $query->whereIn('project_id', $assignedProjectIds->all()),
                fn ($query) => $query->whereRaw('1 = 0')
            )
            ->orderBy('scope_name')
            ->get(['id', 'project_id', 'scope_name'])
            ->map(fn (ProjectScope $scope) => [
                'id' => $scope->id,
                'project_id' => $scope->project_id,
                'scope_name' => $scope->scope_name,
            ])
            ->values();

        $projects = Project::query()
            ->when(
                $assignedProjectIds->isNotEmpty(),
                fn ($query) => $query->whereIn('id', $assignedProjectIds->all()),
                fn ($query) => $query->whereRaw('1 = 0')
            )
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

        $weeklyAccomplishmentsByProjectFilters = [
            'project_id' => $weeklyProjectId,
            'latest_week_start' => $weeklyProjectWeek,
        ];

        return Inertia::render('Foreman/Dashboard', compact(
            'user',
            'attendances',
            'accomplishments',
            'materialRequests',
            'issueReports',
            'deliveries',
            'assignedProjectsPager',
            'materialRequestsPager',
            'issueReportsPager',
            'deliveriesPager',
            'weeklyAccomplishmentsByProjectPager',
            'weeklyAccomplishmentsByProjectFilters',
            'projects',
            'assignedProjects',
            'foremanAttendanceToday',
            'progressPhotos',
            'projectScopes'
        ));
    }

    public function foremanSubmissions()
    {
        $user = Auth::user();
        $assignedProjectIds = $this->resolveForemanAssignedProjectIds($user);
        $assignedProjects = $this->foremanAssignedProjectsPayload($user, $assignedProjectIds);

        $recentMaterialRequests = MaterialRequest::query()
            ->with('project:id,name')
            ->where('foreman_id', $user->id)
            ->latest()
            ->paginate(5, ['*'], 'materials_page')
            ->withQueryString();

        $recentMaterialRequests->setCollection(
            $recentMaterialRequests->getCollection()->map(fn (MaterialRequest $requestRow) => [
                'id' => $requestRow->id,
                'project_id' => $requestRow->project_id,
                'project_name' => $requestRow->project?->name,
                'material_name' => $requestRow->material_name,
                'quantity' => $requestRow->quantity,
                'unit' => $requestRow->unit,
                'remarks' => $requestRow->remarks,
                'status' => $requestRow->status,
                'photo_path' => $requestRow->photo_path,
                'created_at' => optional($requestRow->created_at)?->toDateTimeString(),
            ])
        );

        $recentIssueReports = IssueReport::query()
            ->where('foreman_id', $user->id)
            ->latest()
            ->paginate(5, ['*'], 'issues_page')
            ->withQueryString();

        $recentIssueReports->setCollection(
            $recentIssueReports->getCollection()->map(fn (IssueReport $issueRow) => [
                'id' => $issueRow->id,
                'issue_title' => $issueRow->issue_title,
                'description' => $issueRow->description,
                'severity' => $issueRow->severity,
                'status' => $issueRow->status,
                'photo_path' => $issueRow->photo_path,
                'created_at' => optional($issueRow->created_at)?->toDateTimeString(),
            ])
        );

        $recentDeliveries = DeliveryConfirmation::query()
            ->with('project:id,name')
            ->where('foreman_id', $user->id)
            ->latest()
            ->paginate(5, ['*'], 'deliveries_page')
            ->withQueryString();

        $recentDeliveries->setCollection(
            $recentDeliveries->getCollection()->map(fn (DeliveryConfirmation $deliveryRow) => [
                'id' => $deliveryRow->id,
                'project_id' => $deliveryRow->project_id,
                'project_name' => $deliveryRow->project?->name,
                'item_delivered' => $deliveryRow->item_delivered,
                'quantity' => $deliveryRow->quantity,
                'delivery_date' => $deliveryRow->delivery_date ? (string) $deliveryRow->delivery_date : null,
                'supplier' => $deliveryRow->supplier,
                'status' => $deliveryRow->status,
                'photo_path' => $deliveryRow->photo_path,
                'created_at' => optional($deliveryRow->created_at)?->toDateTimeString(),
            ])
        );

        $progressPhotos = ProgressPhoto::query()
            ->with('project:id,name')
            ->where('foreman_id', $user->id)
            ->when(
                $assignedProjectIds->isNotEmpty(),
                fn ($query) => $query->where(function ($inner) use ($assignedProjectIds) {
                    $inner->whereNull('project_id')->orWhereIn('project_id', $assignedProjectIds->all());
                })
            )
            ->latest()
            ->paginate(8, ['*'], 'photos_page')
            ->withQueryString();

        $progressPhotos->setCollection(
            $progressPhotos->getCollection()->map(fn (ProgressPhoto $photo) => [
                'id' => $photo->id,
                'project_id' => $photo->project_id,
                'photo_path' => $photo->photo_path,
                'caption' => $photo->caption,
                'project_name' => $photo->project?->name ?? 'Unassigned',
                'created_at' => optional($photo->created_at)?->toDateTimeString(),
            ])
        );

        $weeklyScopePhotos = ScopePhoto::query()
            ->with(['scope:id,project_id,scope_name', 'scope.project:id,name'])
            ->whereHas('scope', function ($scopeQuery) use ($assignedProjectIds) {
                if ($assignedProjectIds->isNotEmpty()) {
                    $scopeQuery->whereIn('project_id', $assignedProjectIds->all());
                    return;
                }

                $scopeQuery->whereRaw('1 = 0');
            })
            ->latest()
            ->paginate(10, ['*'], 'weekly_scope_photos_page')
            ->withQueryString();

        $weeklyScopePhotos->setCollection(
            $weeklyScopePhotos->getCollection()->map(function (ScopePhoto $photo) {
                $caption = trim((string) ($photo->caption ?? ''));
                $normalizedCaption = Str::lower($caption);
                $isWeeklyProgressPhoto = Str::startsWith($normalizedCaption, '[jotform weekly]')
                    || Str::startsWith($normalizedCaption, '[public weekly]');

                return [
                    'id' => $photo->id,
                    'project_id' => $photo->scope?->project_id,
                    'project_name' => $photo->scope?->project?->name ?? 'Unassigned',
                    'scope_name' => $photo->scope?->scope_name ?? 'Unknown Scope',
                    'photo_path' => $photo->photo_path,
                    'caption' => $photo->caption,
                    'source' => $isWeeklyProgressPhoto ? 'weekly_progress' : 'monitoring_board',
                    'created_at' => optional($photo->created_at)?->toDateTimeString(),
                ];
            })
        );

        return Inertia::render('Foreman/Submissions', compact(
            'assignedProjects',
            'progressPhotos',
            'weeklyScopePhotos',
            'recentMaterialRequests',
            'recentIssueReports',
            'recentDeliveries'
        ));
    }

    private function projectKpis(): array
    {
        $projects = Project::query()
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'client',
                'status',
                'phase',
                'overall_progress',
                'contract_amount',
                'total_client_payment',
                'remaining_balance',
                'updated_at',
            ]);

        $totalProjects = $projects->count();
        $contractSum = round((float) $projects->sum(fn (Project $project) => (float) $project->contract_amount), 2);
        $collectedSum = round((float) $projects->sum(fn (Project $project) => (float) $project->total_client_payment), 2);
        $remainingSum = round((float) $projects->sum(fn (Project $project) => (float) $project->remaining_balance), 2);
        $companyProgressPercent = $totalProjects > 0
            ? round((float) $projects->avg(fn (Project $project) => (int) $project->overall_progress), 1)
            : 0.0;

        return [
            'project_counts' => [
                'total' => $totalProjects,
                'by_status' => $this->aggregateLabelCounts($projects, 'status'),
                'by_phase' => $this->aggregateLabelCounts($projects, 'phase'),
            ],
            'financial_totals' => [
                'contract_sum' => $contractSum,
                'collected_sum' => $collectedSum,
                'remaining_sum' => $remainingSum,
            ],
            'company_progress_percent' => $companyProgressPercent,
            'projects' => $projects
                ->sortByDesc(fn (Project $project) => optional($project->updated_at)?->timestamp ?? 0)
                ->values()
                ->map(fn (Project $project) => $this->projectSummaryRow($project))
                ->all(),
        ];
    }

    private function payrollAndPaymentKpis(): array
    {
        $payrollPayable = round((float) Payroll::query()->whereIn('status', ['pending', 'ready', 'approved'])->sum('net'), 2);
        $payrollDeductionsTotal = round((float) Payroll::query()->sum('deductions'), 2);
        $payrollPaidTotal = round((float) Payroll::query()->where('status', 'paid')->sum('net'), 2);
        $payrollGrossTotal = round((float) Payroll::query()->sum('gross'), 2);

        $payrollCountsByStatus = Payroll::query()
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->get()
            ->map(fn ($row) => [
                'label' => $this->normalizeLabel($row->status),
                'count' => (int) ($row->aggregate ?? 0),
            ])
            ->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();

        $projects = Project::query()->get(['contract_amount', 'total_client_payment', 'remaining_balance']);
        $contractSum = round((float) $projects->sum(fn (Project $project) => (float) $project->contract_amount), 2);
        $collectedSum = round((float) $projects->sum(fn (Project $project) => (float) $project->total_client_payment), 2);
        $remainingSum = round((float) $projects->sum(fn (Project $project) => (float) $project->remaining_balance), 2);

        return [
            'payroll_payable' => $payrollPayable,
            'payroll_deductions_total' => $payrollDeductionsTotal,
            'payroll_paid_total' => $payrollPaidTotal,
            'payroll_gross_total' => $payrollGrossTotal,
            'payroll_counts_by_status' => $payrollCountsByStatus,
            'payment_totals' => [
                'contract_sum' => $contractSum,
                'collected_sum' => $collectedSum,
                'remaining_sum' => $remainingSum,
            ],
        ];
    }

    private function companyFinancialSummary(float $totalContractValue): array
    {
        $materials = 0.0;
        $laborFromExpenses = 0.0;
        $subcontractors = 0.0;
        $miscellaneous = 0.0;
        $equipment = 0.0;

        Expense::query()
            ->get(['category', 'amount'])
            ->each(function (Expense $expense) use (&$materials, &$laborFromExpenses, &$subcontractors, &$miscellaneous, &$equipment): void {
                $amount = (float) ($expense->amount ?? 0);
                if ($amount <= 0) {
                    return;
                }

                $category = Str::lower(trim((string) ($expense->category ?? '')));

                if ($category === '' || $category === 'uncategorized') {
                    $miscellaneous += $amount;
                    return;
                }

                if (Str::contains($category, ['material'])) {
                    $materials += $amount;
                    return;
                }

                if (Str::contains($category, ['subcontract', 'sub-con', 'subcon'])) {
                    $subcontractors += $amount;
                    return;
                }

                if (Str::contains($category, ['equipment', 'equip', 'tool'])) {
                    $equipment += $amount;
                    return;
                }

                if (Str::contains($category, ['labor', 'labour', 'payroll', 'wage', 'salary'])) {
                    $laborFromExpenses += $amount;
                    return;
                }

                $miscellaneous += $amount;
            });

        $payrollLabor = round((float) Payroll::query()->sum('net'), 2);
        $laborPayroll = $payrollLabor > 0
            ? $payrollLabor
            : round($laborFromExpenses, 2);

        $materials = round($materials, 2);
        $subcontractors = round($subcontractors, 2);
        $miscellaneous = round($miscellaneous, 2);
        $equipment = round($equipment, 2);

        $totalExpenses = round($materials + $laborPayroll + $subcontractors + $miscellaneous + $equipment, 2);
        $netProfit = round($totalContractValue - $totalExpenses, 2);
        $netMarginPercent = $totalContractValue > 0
            ? round(($netProfit / $totalContractValue) * 100, 2)
            : 0.0;

        return [
            'total_contract_value' => round($totalContractValue, 2),
            'materials' => $materials,
            'labor_payroll' => $laborPayroll,
            'subcontractors' => $subcontractors,
            'miscellaneous' => $miscellaneous,
            'equipment' => $equipment,
            'total_expenses' => $totalExpenses,
            'net_profit' => $netProfit,
            'net_margin_percent' => $netMarginPercent,
        ];
    }

    private function aggregateLabelCounts(Collection $models, string $column): array
    {
        return $models
            ->groupBy(fn ($model) => $this->normalizeLabel((string) data_get($model, $column)))
            ->map(fn (Collection $group, string $label) => [
                'label' => $label,
                'count' => $group->count(),
            ])
            ->sortBy('label', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();
    }

    private function normalizeLabel(?string $value, string $fallback = 'Unknown'): string
    {
        $clean = trim((string) $value);

        return $clean !== '' ? $clean : $fallback;
    }

    private function projectSummaryRow(Project $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'client' => $project->client,
            'status' => $project->status,
            'phase' => $project->phase,
            'overall_progress' => (int) ($project->overall_progress ?? 0),
            'contract_amount' => (float) $project->contract_amount,
            'total_client_payment' => (float) $project->total_client_payment,
            'remaining_balance' => (float) $project->remaining_balance,
            'updated_at' => optional($project->updated_at)?->toDateTimeString(),
        ];
    }

    private function resolveForemanAssignedProjectIds(User $user): Collection
    {
        $assigned = ProjectAssignment::query()
            ->where('user_id', $user->id)
            ->pluck('project_id')
            ->map(fn ($projectId) => (int) $projectId)
            ->unique()
            ->values();

        if ($assigned->isNotEmpty()) {
            return $assigned;
        }

        $fullname = trim((string) ($user->fullname ?? ''));
        if ($fullname === '') {
            return collect();
        }

        return Project::query()
            ->whereNotNull('assigned')
            ->where('assigned', '!=', '')
            ->get(['id', 'assigned'])
            ->filter(function (Project $project) use ($fullname) {
                $assignedNames = collect(preg_split('/[,;]+/', (string) $project->assigned))
                    ->map(fn ($part) => trim((string) $part))
                    ->filter();

                return $assignedNames->contains($fullname);
            })
            ->pluck('id')
            ->map(fn ($projectId) => (int) $projectId)
            ->unique()
            ->values();
    }

    private function foremanAssignedProjectsPayload(User $user, Collection $assignedProjectIds): array
    {
        if ($assignedProjectIds->isEmpty()) {
            return [];
        }

        return Project::query()
            ->whereIn('id', $assignedProjectIds->all())
            ->orderBy('name')
            ->get(['id', 'name', 'client', 'phase', 'status', 'overall_progress'])
            ->map(function (Project $project) use ($user) {
                $token = $this->ensureForemanSubmitToken($project, $user);

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'client' => $project->client,
                    'phase' => $project->phase,
                    'status' => $project->status,
                    'overall_progress' => (int) ($project->overall_progress ?? 0),
                    'submit_token' => $token->token,
                    'public_submit_url' => route('public.progress-submit.show', ['token' => $token->token]),
                ];
            })
            ->values()
            ->all();
    }

    private function paginateCollection(Collection $rows, int $perPage, string $pageName, Request $request): LengthAwarePaginator
    {
        $page = max(1, (int) $request->query($pageName, 1));
        $total = $rows->count();
        $items = $rows->forPage($page, $perPage)->values();

        return (new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'pageName' => $pageName,
            ]
        ))->appends($request->query());
    }

    private function ensureForemanSubmitToken(Project $project, User $user): ProgressSubmitToken
    {
        $existing = ProgressSubmitToken::query()
            ->where('project_id', $project->id)
            ->where('foreman_id', $user->id)
            ->orderByDesc('id')
            ->get()
            ->first(fn (ProgressSubmitToken $token) => $token->isActive());

        if ($existing) {
            return $existing;
        }

        return ProgressSubmitToken::create([
            'project_id' => $project->id,
            'foreman_id' => $user->id,
            'token' => Str::lower(Str::random(64)),
            'expires_at' => now()->addYears(5),
            'submission_count' => 0,
        ]);
    }
}
