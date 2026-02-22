<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\Worker;
use App\Models\WeeklyAccomplishment;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ForemansController extends Controller
{
    public function attendanceIndex(Request $request)
    {
        $foremanId = Auth::id();
        $allowedPerPage = [5, 10, 25, 50];
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $query = Attendance::query()
            ->where('foreman_id', $foremanId)
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

        $attendances = collect($paginator->items())->map(fn (Attendance $attendance) => [
            'id' => $attendance->id,
            'date' => optional($attendance->date)?->toDateString(),
            'can_edit_today' => (bool) optional($attendance->date)?->isToday(),
            'worker_name' => $attendance->worker_name,
            'worker_role' => $attendance->worker_role,
            'project_id' => $attendance->project_id,
            'project_name' => $attendance->project?->name,
            'time_in' => $attendance->time_in,
            'time_out' => $attendance->time_out,
            'hours' => (float) ($attendance->hours ?? 0),
            'selfie_path' => $attendance->selfie_path,
        ])->values();

        $projects = Project::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Project $project) => ['id' => $project->id, 'name' => $project->name])
            ->values();

        $workers = Worker::query()
            ->where('foreman_id', $foremanId)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Worker $worker) => ['id' => $worker->id, 'name' => $worker->name])
            ->values();

        $stats = [
            'today_logs' => Attendance::where('foreman_id', $foremanId)->whereDate('date', today())->count(),
            'this_week_hours' => round((float) Attendance::where('foreman_id', $foremanId)->whereBetween('date', [today()->startOfWeek(), today()->endOfWeek()])->sum('hours'), 1),
            'total_logs' => Attendance::where('foreman_id', $foremanId)->count(),
        ];

        return Inertia::render('Foreman/Attendance', [
            'projects' => $projects,
            'workers' => $workers,
            'attendances' => $attendances,
            'attendanceTable' => [
                'search' => $search,
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

    public function updateAttendance(Request $request, Attendance $attendance)
    {
        $foremanId = Auth::id();
        abort_unless((int) $attendance->foreman_id === (int) $foremanId, 403);

        if (!optional($attendance->date)?->isToday()) {
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

        $today = today()->toDateString();
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
            'caption' => 'nullable|string',
        ]);

        $path = $request->file('photo')->store('progress-photos', 'public');

        ProgressPhoto::create([
            'foreman_id' => Auth::id(),
            'photo_path' => $path,
            'caption'    => $request->caption,
        ]);

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
                'date' => !empty($entry['date']) ? $entry['date'] : today()->toDateString(),
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
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }
}
