<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use App\Models\Worker;
use App\Models\WeeklyAccomplishment;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ForemansController extends Controller
{
    private const PH_TIMEZONE = 'Asia/Manila';

    public function attendanceIndex(Request $request)
    {
        $foreman = Auth::user();
        $foremanId = $foreman?->id;
        $foremanName = trim((string) ($foreman?->fullname ?? ''));
        $assignedProjectIds = $foreman ? $this->foremanAssignedProjectIds($foreman) : collect();
        $manilaNow = Carbon::now(self::PH_TIMEZONE);
        $phToday = $manilaNow->toDateString();
        $phWeekStart = $manilaNow->copy()->startOfWeek()->toDateString();
        $phWeekEnd = $manilaNow->copy()->endOfWeek()->toDateString();
        $allowedPerPage = [5, 10, 25, 50];
        $search = trim((string) $request->query('search', ''));
        $dateFilter = $this->normalizeAttendanceFilterDate($request->query('date'), $phToday);
        $perPage = (int) $request->query('per_page', 50);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 50;
        }

        $query = Attendance::query()
            ->where('foreman_id', $foremanId)
            ->whereDate('date', $dateFilter)
            ->with('project:id,name');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('worker_name', 'like', "%{$search}%")
                    ->orWhere('worker_role', 'like', "%{$search}%")
                    ->orWhereHas('project', fn ($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        $paginator = $query
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        $attendances = collect($paginator->items())->map(function (Attendance $attendance) use ($foremanName, $phToday) {
            $isForemanSelfLog = $attendance->worker_role === 'Foreman'
                && $foremanName !== ''
                && trim((string) $attendance->worker_name) === $foremanName;

            return [
            'id' => $attendance->id,
            'date' => optional($attendance->date)?->toDateString(),
            'can_edit_today' => ((string) optional($attendance->date)?->toDateString() === $phToday) && !$isForemanSelfLog,
            'is_foreman_self_log' => $isForemanSelfLog,
            'worker_name' => $attendance->worker_name,
            'worker_role' => $attendance->worker_role,
            'project_id' => $attendance->project_id,
            'project_name' => $attendance->project?->name,
            'time_in' => $attendance->time_in,
            'time_out' => $attendance->time_out,
            'hours' => (float) ($attendance->hours ?? 0),
            'selfie_path' => $attendance->selfie_path,
            ];
        })->values();

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

        $workers = Worker::query()
            ->where('foreman_id', $foremanId)
            ->with('project:id,name')
            ->when(
                $assignedProjectIds->isNotEmpty(),
                fn ($query) => $query->whereIn('project_id', $assignedProjectIds->all())
            )
            ->orderBy('name')
            ->get(['id', 'project_id', 'name'])
            ->map(fn (Worker $worker) => [
                'id' => $worker->id,
                'name' => $worker->name,
                'role' => null,
                'project_id' => $worker->project_id,
                'project_name' => $worker->project?->name,
            ])
            ->values();

        $foremanAttendanceToday = null;
        if ($foremanId && $foremanName !== '') {
            $selfLog = Attendance::query()
                ->where('foreman_id', $foremanId)
                ->whereDate('date', $phToday)
                ->where('worker_role', 'Foreman')
                ->where('worker_name', $foremanName)
                ->orderByDesc('id')
                ->first();

            if ($selfLog) {
                $foremanAttendanceToday = [
                    'id' => $selfLog->id,
                    'date' => optional($selfLog->date)?->toDateString(),
                    'worker_name' => $selfLog->worker_name,
                    'worker_role' => $selfLog->worker_role,
                    'project_id' => $selfLog->project_id,
                    'project_name' => $selfLog->project?->name,
                    'time_in' => $selfLog->time_in,
                    'time_out' => $selfLog->time_out,
                    'hours' => (float) ($selfLog->hours ?? 0),
                ];
            }
        }

        $stats = [
            'today_logs' => Attendance::where('foreman_id', $foremanId)->whereDate('date', $phToday)->count(),
            'this_week_hours' => round((float) Attendance::where('foreman_id', $foremanId)->whereBetween('date', [$phWeekStart, $phWeekEnd])->sum('hours'), 1),
            'total_logs' => Attendance::where('foreman_id', $foremanId)->count(),
        ];

        return Inertia::render('Foreman/Attendance', [
            'projects' => $projects,
            'workers' => $workers,
            'foremanAttendanceToday' => $foremanAttendanceToday,
            'attendances' => $attendances,
            'attendanceTable' => [
                'search' => $search,
                'date' => $dateFilter,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'stats' => $stats,
        ]);
    }

    public function timeInAttendance(Request $request)
    {
        $foreman = $request->user();
        abort_unless($foreman && $foreman->role === 'foreman', 403);

        $assignedProjectIds = $this->foremanAssignedProjectIds($foreman)->all();

        $validated = $request->validate([
            'project_id' => ['required', Rule::in($assignedProjectIds)],
        ]);

        $foremanName = trim((string) ($foreman->fullname ?? ''));
        if ($foremanName === '') {
            return $this->foremanActionRedirect($request)
                ->with('error', 'Foreman full name is required to record attendance.');
        }

        $manilaNow = Carbon::now(self::PH_TIMEZONE);
        $phToday = $manilaNow->toDateString();

        $existingToday = Attendance::query()
            ->where('foreman_id', $foreman->id)
            ->whereDate('date', $phToday)
            ->where('worker_role', 'Foreman')
            ->where('worker_name', $foremanName)
            ->first();

        if ($existingToday) {
            return $this->foremanActionRedirect($request)
                ->with('error', 'Foreman time-in for today is already recorded.');
        }

        Attendance::create([
            'foreman_id' => $foreman->id,
            'project_id' => $validated['project_id'],
            'worker_name' => $foremanName,
            'worker_role' => 'Foreman',
            'date' => $phToday,
            'time_in' => $manilaNow->format('H:i'),
            'time_out' => null,
            'hours' => 0,
            'attendance_code' => null,
            'selfie_path' => null,
        ]);

        return $this->foremanActionRedirect($request)
            ->with('success', 'Foreman time-in recorded.');
    }

    public function timeOutAttendance(Request $request)
    {
        $foreman = $request->user();
        abort_unless($foreman && $foreman->role === 'foreman', 403);

        $foremanName = trim((string) ($foreman->fullname ?? ''));
        if ($foremanName === '') {
            return $this->foremanActionRedirect($request)
                ->with('error', 'Foreman full name is required to record attendance.');
        }

        $manilaNow = Carbon::now(self::PH_TIMEZONE);
        $phToday = $manilaNow->toDateString();

        $selfLog = Attendance::query()
            ->where('foreman_id', $foreman->id)
            ->whereDate('date', $phToday)
            ->where('worker_role', 'Foreman')
            ->where('worker_name', $foremanName)
            ->orderByDesc('id')
            ->first();

        if (!$selfLog) {
            return $this->foremanActionRedirect($request)
                ->with('error', 'No foreman time-in found for today.');
        }

        if (!empty($selfLog->time_out)) {
            return $this->foremanActionRedirect($request)
                ->with('error', 'Foreman time-out for today is already recorded.');
        }

        $timeOut = $manilaNow->format('H:i');
        $selfLog->update([
            'time_out' => $timeOut,
            'hours' => $this->resolveAttendanceHours([
                'time_in' => $selfLog->time_in,
                'time_out' => $timeOut,
                'hours' => $selfLog->hours,
            ]),
            'attendance_code' => null,
        ]);

        return $this->foremanActionRedirect($request)
            ->with('success', 'Foreman time-out recorded.');
    }

    public function updateAttendance(Request $request, Attendance $attendance)
    {
        $foremanId = Auth::id();
        $foreman = $request->user();
        $assignedProjectIds = $foreman ? $this->foremanAssignedProjectIds($foreman)->all() : [];
        abort_unless((int) $attendance->foreman_id === (int) $foremanId, 403);

        if ((string) optional($attendance->date)?->toDateString() !== Carbon::now(self::PH_TIMEZONE)->toDateString()) {
            return redirect()
                ->route('foreman.attendance.index', $this->attendanceTableQueryParams($request))
                ->with('error', 'Only attendance logs dated today can be edited.');
        }

        $validated = $request->validate([
            'worker_name' => 'required|string',
            'worker_role' => 'required|string',
            'project_id' => ['nullable', Rule::in($assignedProjectIds)],
            'time_in' => 'nullable|date_format:H:i',
            'time_out' => 'nullable|date_format:H:i',
            'hours' => 'nullable|numeric|min:0',
        ]);

        $attendance->update([
            'worker_name' => $validated['worker_name'],
            'worker_role' => $validated['worker_role'],
            'project_id' => $validated['project_id'] ?? null,
            'time_in' => $validated['time_in'] ?? null,
            'time_out' => $validated['time_out'] ?? null,
            'hours' => $this->resolveAttendanceHours($validated),
            'attendance_code' => null,
        ]);

        return redirect()
            ->route('foreman.attendance.index', $this->attendanceTableQueryParams($request))
            ->with('success', 'Attendance log updated.');
    }

    public function storeAttendance(Request $request)
    {
        $foreman = $request->user();
        abort_unless($foreman && $foreman->role === 'foreman', 403);
        $assignedProjectIds = $this->foremanAssignedProjectIds($foreman)->all();

        $validated = $request->validate([
            'attendance' => 'required|array|min:1',
            'attendance.*.worker_name' => 'required|string',
            'attendance.*.worker_role' => 'required|string',
            'attendance.*.project_id' => ['nullable', Rule::in($assignedProjectIds)],
            'attendance.*.date' => 'nullable|date',
            'attendance.*.time_in' => 'nullable|date_format:H:i',
            'attendance.*.time_out' => 'nullable|date_format:H:i',
            'attendance.*.hours' => 'nullable|numeric|min:0',
            'attendance.*.selfie_path' => 'nullable|string|max:2048',
        ]);

        $today = Carbon::now(self::PH_TIMEZONE)->toDateString();
        $entries = collect($validated['attendance'])
            ->map(function (array $entry) use ($today) {
                $entry['date'] = $today;
                return $entry;
            })
            ->values()
            ->all();

        $this->createAttendanceEntries($entries, (int) $foreman->id);

        $query = array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');

        return redirect()
            ->route('foreman.attendance.index', $query)
            ->with('success', 'Attendance submitted.');
    }

    public function submitAll(Request $request)
    {
        $foreman = $request->user();
        abort_unless($foreman && $foreman->role === 'foreman', 403);
        $assignedProjectIds = $this->foremanAssignedProjectIds($foreman)->all();

        $request->validate([
            'attendance'                         => 'nullable|array',
            'attendance.*.worker_name'           => 'required_with:attendance|string',
            'attendance.*.worker_role'           => 'required_with:attendance|string',
            'attendance.*.project_id'            => ['nullable', Rule::in($assignedProjectIds)],
            'attendance.*.date'                  => 'required_with:attendance|date',
            'attendance.*.time_in'               => 'nullable|date_format:H:i',
            'attendance.*.time_out'              => 'nullable|date_format:H:i',
            'attendance.*.hours'                 => 'nullable|numeric|min:0',
            'attendance.*.selfie_path'           => 'nullable|string|max:2048',

            'week_start'                         => 'nullable|date',
            'accomplishment_project_id'          => ['nullable', 'required_with:scopes', Rule::in($assignedProjectIds)],
            'scopes'                             => 'nullable|array',
            'scopes.*.scope_of_work'             => 'required_with:scopes|string',
            'scopes.*.percent_completed'         => 'required_with:scopes|numeric|min:0|max:100',

            'material_items'                     => 'nullable|array',
            'material_items.*.material_name'     => 'required_with:material_items|string',
            'material_items.*.quantity'          => 'required_with:material_items|string',
            'material_items.*.unit'              => 'required_with:material_items|string',
            'material_items.*.remarks'           => 'nullable|string',
            'material_items.*.project_id'        => ['nullable', Rule::in($assignedProjectIds)],

            'issue_title'                        => 'nullable|string',
            'description'                        => 'nullable|string',
            'severity'                           => 'nullable|in:low,medium,high',
            'issue_project_id'                   => ['nullable', Rule::in($assignedProjectIds)],

            'item_delivered'                     => 'nullable|string',
            'quantity'                           => 'nullable|string',
            'delivery_date'                      => 'nullable|date',
            'delivery_project_id'                => ['nullable', 'required_with:item_delivered,delivery_date', Rule::in($assignedProjectIds)],
            'supplier'                           => 'nullable|string',
            'status'                             => 'nullable|in:received,incomplete,rejected',
        ]);

        $foremanId = (int) $foreman->id;
 
        if (!empty($request->attendance)) {
            $this->createAttendanceEntries($request->attendance, $foremanId);
        } 

        $accomplishmentProjectId = $request->filled('accomplishment_project_id')
            ? (int) $request->accomplishment_project_id
            : null;

        if (!empty($request->scopes) && $request->week_start) {
            $resolvedWeekStart = Carbon::parse((string) $request->week_start)
                ->startOfWeek(Carbon::MONDAY)
                ->toDateString();

            foreach ($request->scopes as $scope) {
                $scopeName = trim((string) ($scope['scope_of_work'] ?? ''));
                $percentCompleted = $scope['percent_completed'] ?? null;

                if ($scopeName !== '' && $percentCompleted !== '' && $percentCompleted !== null) {
                    WeeklyAccomplishment::updateOrCreate(
                        [
                            'foreman_id' => $foremanId,
                            'project_id' => $accomplishmentProjectId,
                            'week_start' => $resolvedWeekStart,
                            'scope_of_work' => $scopeName,
                        ],
                        [
                            'percent_completed' => $percentCompleted,
                        ]
                    );
                }
            }

            if ($accomplishmentProjectId !== null) {
                $this->syncProjectScopesFromWeeklyEntries(
                    $accomplishmentProjectId,
                    trim((string) ($foreman->fullname ?? '')),
                    $request->scopes
                );
                $this->syncProjectOverallProgressFromWeekly($accomplishmentProjectId);
            }
        }
 
        if (!empty($request->material_items)) {
            foreach ($request->material_items as $item) {
                if (!empty($item['material_name'])) {
                    $materialProjectId = null;
                    if (isset($item['project_id']) && $item['project_id'] !== null && $item['project_id'] !== '') {
                        $materialProjectId = (int) $item['project_id'];
                    } elseif ($accomplishmentProjectId !== null) {
                        $materialProjectId = $accomplishmentProjectId;
                    } elseif ($request->filled('delivery_project_id')) {
                        $materialProjectId = (int) $request->delivery_project_id;
                    }

                    MaterialRequest::create([
                        'project_id'    => $materialProjectId,
                        'foreman_id'    => $foremanId,
                        'material_name' => $item['material_name'],
                        'quantity'      => $item['quantity'],
                        'unit'          => $item['unit'],
                        'remarks'       => $item['remarks'] ?? null,
                    ]);
                }
            }
        }
 
        if (!empty($request->issue_title) && !empty($request->description)) {
            $issueProjectId = null;
            if ($request->filled('issue_project_id')) {
                $issueProjectId = (int) $request->issue_project_id;
            } elseif ($accomplishmentProjectId !== null) {
                $issueProjectId = $accomplishmentProjectId;
            } elseif ($request->filled('delivery_project_id')) {
                $issueProjectId = (int) $request->delivery_project_id;
            }

            IssueReport::create([
                'project_id'  => $issueProjectId,
                'foreman_id'  => $foremanId,
                'issue_title' => $request->issue_title,
                'description' => $request->description,
                'severity'    => $request->severity ?? 'medium',
            ]);
        }
 
        if (!empty($request->item_delivered) && !empty($request->delivery_date)) {
            DeliveryConfirmation::create([
                'project_id'      => $request->filled('delivery_project_id') ? (int) $request->delivery_project_id : null,
                'foreman_id'     => $foremanId,
                'item_delivered' => $request->item_delivered,
                'quantity'       => $request->quantity,
                'delivery_date'  => $request->delivery_date,
                'supplier'       => $request->supplier,
                'status'         => $request->status ?? 'received',
            ]);
        }

        return back()->with('success', 'All entries submitted successfully.');
    }

    public function storeProgressPhoto(Request $request)
    {
        $request->validate([
            'photo'   => 'required|image|max:5120',
            'caption' => 'nullable|string|max:1000',
            'project_id' => 'nullable|exists:projects,id',
            'scope_id' => 'nullable|exists:project_scopes,id',
        ]);

        $projectId = $request->project_id ? (int) $request->project_id : null;
        $scope = null;
        if ($request->filled('scope_id')) {
            $scope = ProjectScope::query()->findOrFail((int) $request->scope_id);

            if ($projectId !== null && (int) $scope->project_id !== $projectId) {
                return back()
                    ->withErrors(['scope_id' => 'Selected scope does not belong to selected project.'])
                    ->withInput();
            }

            $projectId = (int) $scope->project_id;
        }

        $path = $request->file('photo')->store('progress-photos', 'public');

        ProgressPhoto::create([
            'foreman_id' => Auth::id(),
            'project_id' => $projectId,
            'photo_path' => $path,
            'caption'    => $request->caption,
        ]);

        if ($scope) {
            $scope->photos()->create([
                'photo_path' => $path,
                'caption' => $request->caption,
            ]);
        }

        return back()->with('success', 'Photo uploaded.');
    }

    private function createAttendanceEntries(array $entries, int $foremanId): void
    {
        foreach ($entries as $entry) {
            Attendance::create([
                'foreman_id' => $foremanId,
                'project_id' => $entry['project_id'] ?? null,
                'worker_name' => $entry['worker_name'],
                'worker_role' => $entry['worker_role'],
                'date' => !empty($entry['date']) ? $entry['date'] : Carbon::now(self::PH_TIMEZONE)->toDateString(),
                'time_in' => $entry['time_in'] ?? null,
                'time_out' => $entry['time_out'] ?? null,
                'hours' => $this->resolveAttendanceHours($entry),
                'attendance_code' => null,
                'selfie_path' => $entry['selfie_path'] ?? null,
            ]);
        }
    }

    private function resolveAttendanceHours(array $entry): float
    {
        $computedHours = isset($entry['hours']) ? (float) $entry['hours'] : 0.0;

        if (!empty($entry['time_in']) && !empty($entry['time_out'])) {
            try {
                $timeIn = Carbon::createFromFormat('H:i', $entry['time_in']);
                $timeOut = Carbon::createFromFormat('H:i', $entry['time_out']);

                if ($timeOut->greaterThan($timeIn)) {
                    $computedHours = round($timeIn->diffInMinutes($timeOut) / 60, 1);
                }
            } catch (\Throwable $e) {
                // Keep provided hours fallback if time parsing fails.
            }
        }

        return $computedHours;
    }

    private function attendanceTableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'date' => $request->query('date'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function normalizeAttendanceFilterDate(mixed $rawDate, string $fallbackDate): string
    {
        $value = trim((string) $rawDate);
        if ($value === '') {
            return $fallbackDate;
        }

        try {
            return Carbon::createFromFormat('Y-m-d', $value, self::PH_TIMEZONE)->toDateString();
        } catch (\Throwable $e) {
            return $fallbackDate;
        }
    }

    private function foremanAssignedProjectIds(User $foreman): Collection
    {
        $assigned = ProjectAssignment::query()
            ->where('user_id', $foreman->id)
            ->where('role_in_project', 'foreman')
            ->pluck('project_id')
            ->map(fn ($projectId) => (int) $projectId)
            ->unique()
            ->values();

        if ($assigned->isNotEmpty()) {
            return $assigned;
        }

        $fullname = trim((string) ($foreman->fullname ?? ''));
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

    private function syncProjectOverallProgressFromWeekly(int $projectId): void
    {
        if ($projectId <= 0) {
            return;
        }

        $project = Project::query()->find($projectId);
        if (!$project) {
            return;
        }

        $latestWeekStart = WeeklyAccomplishment::query()
            ->where('project_id', $projectId)
            ->max('week_start');

        $progressPercent = null;

        if ($latestWeekStart) {
            $progressPercent = (float) (WeeklyAccomplishment::query()
                ->where('project_id', $projectId)
                ->whereDate('week_start', $latestWeekStart)
                ->avg('percent_completed') ?? 0);
        }

        if ($progressPercent === null) {
            $progressPercent = (float) ($project->scopes()->avg('progress_percent') ?? 0);
        }

        $overallProgress = (int) round(max(0, min(100, $progressPercent)));

        if ((int) ($project->overall_progress ?? 0) !== $overallProgress) {
            $project->update([
                'overall_progress' => $overallProgress,
            ]);
        }
    }

    private function syncProjectScopesFromWeeklyEntries(int $projectId, string $fallbackAssignee, iterable $weeklyScopes): void
    {
        if ($projectId <= 0) {
            return;
        }

        $assignee = trim($fallbackAssignee);

        foreach ($weeklyScopes as $scope) {
            $scopeName = trim((string) ($scope['scope_of_work'] ?? ''));
            if ($scopeName === '') {
                continue;
            }

            $progress = (int) round(max(0, min(100, (float) ($scope['percent_completed'] ?? 0))));
            $existingScope = ProjectScope::query()
                ->where('project_id', $projectId)
                ->whereRaw('LOWER(scope_name) = ?', [Str::lower($scopeName)])
                ->first();

            if ($existingScope) {
                $updates = [
                    'progress_percent' => $progress,
                ];

                if (trim((string) ($existingScope->assigned_personnel ?? '')) === '' && $assignee !== '') {
                    $updates['assigned_personnel'] = $assignee;
                }

                $existingScope->update($updates);
                continue;
            }

            ProjectScope::query()->create([
                'project_id' => $projectId,
                'scope_name' => $scopeName,
                'assigned_personnel' => $assignee !== '' ? $assignee : null,
                'progress_percent' => $progress,
                'status' => $this->scopeStatusFromProgress($progress),
                'remarks' => null,
            ]);
        }
    }

    private function scopeStatusFromProgress(int $progress): string
    {
        if ($progress >= 100) {
            return 'COMPLETED';
        }

        if ($progress <= 0) {
            return 'NOT_STARTED';
        }

        return 'IN_PROGRESS';
    }

    private function foremanActionRedirect(Request $request)
    {
        $referer = (string) $request->headers->get('referer', '');
        if ($referer !== '') {
            return redirect()->to($referer);
        }

        return redirect()->route('foreman.attendance.index', $this->attendanceTableQueryParams($request));
    }
}
