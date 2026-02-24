<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\Worker;
use App\Models\WeeklyAccomplishment;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ForemansController extends Controller
{
    private const PH_TIMEZONE = 'Asia/Manila';

    public function attendanceIndex(Request $request)
    {
        $foreman = Auth::user();
        $foremanId = $foreman?->id;
        $foremanName = trim((string) ($foreman?->fullname ?? ''));
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
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Project $project) => ['id' => $project->id, 'name' => $project->name])
            ->values();

        $workers = Worker::query()
            ->where('foreman_id', $foremanId)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Worker $worker) => ['id' => $worker->id, 'name' => $worker->name, 'role' => null])
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

        $validated = $request->validate([
            'project_id' => 'required|exists:projects,id',
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
        ]);

        return $this->foremanActionRedirect($request)
            ->with('success', 'Foreman time-out recorded.');
    }

    public function updateAttendance(Request $request, Attendance $attendance)
    {
        $foremanId = Auth::id();
        abort_unless((int) $attendance->foreman_id === (int) $foremanId, 403);

        if ((string) optional($attendance->date)?->toDateString() !== Carbon::now(self::PH_TIMEZONE)->toDateString()) {
            return redirect()
                ->route('foreman.attendance.index', $this->attendanceTableQueryParams($request))
                ->with('error', 'Only attendance logs dated today can be edited.');
        }

        $validated = $request->validate([
            'worker_name' => 'required|string',
            'worker_role' => 'required|string',
            'project_id' => 'nullable|exists:projects,id',
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
        ]);

        return redirect()
            ->route('foreman.attendance.index', $this->attendanceTableQueryParams($request))
            ->with('success', 'Attendance log updated.');
    }

    public function storeAttendance(Request $request)
    {
        $validated = $request->validate([
            'attendance' => 'required|array|min:1',
            'attendance.*.worker_name' => 'required|string',
            'attendance.*.worker_role' => 'required|string',
            'attendance.*.project_id' => 'nullable|exists:projects,id',
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

        $this->createAttendanceEntries($entries, Auth::id());

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
        $request->validate([
            'attendance'                         => 'nullable|array',
            'attendance.*.worker_name'           => 'required_with:attendance|string',
            'attendance.*.worker_role'           => 'required_with:attendance|string',
            'attendance.*.project_id'            => 'nullable|exists:projects,id',
            'attendance.*.date'                  => 'required_with:attendance|date',
            'attendance.*.time_in'               => 'nullable|date_format:H:i',
            'attendance.*.time_out'              => 'nullable|date_format:H:i',
            'attendance.*.hours'                 => 'nullable|numeric|min:0',
            'attendance.*.selfie_path'           => 'nullable|string|max:2048',

            'week_start'                         => 'nullable|date',
            'scopes'                             => 'nullable|array',
            'scopes.*.scope_of_work'             => 'required_with:scopes|string',
            'scopes.*.percent_completed'         => 'required_with:scopes|numeric|min:0|max:100',

            'material_items'                     => 'nullable|array',
            'material_items.*.material_name'     => 'required_with:material_items|string',
            'material_items.*.quantity'          => 'required_with:material_items|string',
            'material_items.*.unit'              => 'required_with:material_items|string',
            'material_items.*.remarks'           => 'nullable|string',

            'issue_title'                        => 'nullable|string',
            'description'                        => 'nullable|string',
            'severity'                           => 'nullable|in:low,medium,high',

            'item_delivered'                     => 'nullable|string',
            'quantity'                           => 'nullable|string',
            'delivery_date'                      => 'nullable|date',
            'supplier'                           => 'nullable|string',
            'status'                             => 'nullable|in:received,incomplete,rejected',
        ]);

        $foremanId = Auth::id();
 
        if (!empty($request->attendance)) {
            $this->createAttendanceEntries($request->attendance, $foremanId);
        } 

        if (!empty($request->scopes) && $request->week_start) {
            foreach ($request->scopes as $scope) {
                if ($scope['percent_completed'] !== '' && $scope['percent_completed'] !== null) {
                    WeeklyAccomplishment::create([
                        'foreman_id'        => $foremanId,
                        'week_start'        => $request->week_start,
                        'scope_of_work'     => $scope['scope_of_work'],
                        'percent_completed' => $scope['percent_completed'],
                    ]);
                }
            }
        }
 
        if (!empty($request->material_items)) {
            foreach ($request->material_items as $item) {
                if (!empty($item['material_name'])) {
                    MaterialRequest::create([
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
            IssueReport::create([
                'foreman_id'  => $foremanId,
                'issue_title' => $request->issue_title,
                'description' => $request->description,
                'severity'    => $request->severity ?? 'medium',
            ]);
        }
 
        if (!empty($request->item_delivered) && !empty($request->delivery_date)) {
            DeliveryConfirmation::create([
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

    private function foremanActionRedirect(Request $request)
    {
        $referer = (string) $request->headers->get('referer', '');
        if ($referer !== '') {
            return redirect()->to($referer);
        }

        return redirect()->route('foreman.attendance.index', $this->attendanceTableQueryParams($request));
    }
}
