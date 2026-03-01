<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\ProjectScope;
use App\Models\ProjectUpdate;
use App\Models\ScopePhoto;
use App\Models\WeeklyAccomplishment;
use App\Models\Worker;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PublicProgressController extends Controller
{
    private const ATTENDANCE_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    private const ATTENDANCE_DAY_OFFSETS = [
        'mon' => 0,
        'tue' => 1,
        'wed' => 2,
        'thu' => 3,
        'fri' => 4,
        'sat' => 5,
        'sun' => 6,
    ];
    private const ATTENDANCE_STATUS_HOURS = [
        'P' => 8.0,
        'A' => 0.0,
        'H' => 4.0,
        'R' => 0.0,
        'F' => 0.0,
    ];
    private const WEEKLY_SCOPE_OF_WORKS = [
        'Mobilization and Hauling',
        'Foundation Preparation',
        'Column Footing',
        'Column',
        'Wall Footing',
        'Second-Floor Beam, Slab and Stairs',
        'Slab on Fill',
        'CHB Laying with Plastering',
        'Garage Flooring',
        'Roof Facade and Garage Partition',
        'Roofing and Tinsmithry (garage included)',
        'Roof Beam',
        'Ceiling Works',
        'Doors and Jambs',
        'Aluminum Doors and Windows',
        'Second-Floor Level Floor Tile',
        'Lower Level Floor Tile',
        'Kitchen Counter Cabinet',
        'Canopy',
    ];
    private const PHOTO_CATEGORIES = [
        'Slab Work',
        'Plumbing Rough-in',
        'Electrical',
        'Masonry',
        'Finishing',
        'Safety',
        'General Progress',
    ];

    public function show(string $token)
    {
        $submitToken = $this->resolveActiveToken($token);
        $workers = Worker::query()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where(function ($query) use ($submitToken) {
                $query->whereNull('project_id')->orWhere('project_id', $submitToken->project_id);
            })
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Worker $worker) => [
                'id' => $worker->id,
                'name' => $worker->name,
                'role' => 'Worker',
            ])
            ->values();

        $recentPhotos = ProgressPhoto::query()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where('project_id', $submitToken->project_id)
            ->latest()
            ->take(8)
            ->get(['id', 'photo_path', 'caption', 'created_at'])
            ->map(fn (ProgressPhoto $photo) => [
                'id' => $photo->id,
                'photo_path' => $photo->photo_path,
                'caption' => $photo->caption,
                'created_at' => optional($photo->created_at)?->toDateString(),
            ])
            ->values();

        $recentDeliveries = DeliveryConfirmation::query()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where('project_id', $submitToken->project_id)
            ->latest()
            ->take(5)
            ->get(['id', 'item_delivered', 'quantity', 'delivery_date', 'supplier', 'status', 'photo_path', 'created_at'])
            ->map(fn (DeliveryConfirmation $delivery) => [
                'id' => $delivery->id,
                'item_delivered' => $delivery->item_delivered,
                'quantity' => $delivery->quantity,
                'delivery_date' => $delivery->delivery_date ? Carbon::parse($delivery->delivery_date)->toDateString() : null,
                'supplier' => $delivery->supplier,
                'status' => $delivery->status,
                'photo_path' => $delivery->photo_path,
                'created_at' => optional($delivery->created_at)?->toDateTimeString(),
            ])
            ->values();

        $recentMaterialRequests = MaterialRequest::query()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where('project_id', $submitToken->project_id)
            ->latest()
            ->take(5)
            ->get(['id', 'project_id', 'material_name', 'quantity', 'unit', 'remarks', 'status', 'photo_path', 'created_at'])
            ->map(fn (MaterialRequest $requestRow) => [
                'id' => $requestRow->id,
                'project_id' => $requestRow->project_id,
                'material_name' => $requestRow->material_name,
                'quantity' => $requestRow->quantity,
                'unit' => $requestRow->unit,
                'remarks' => $requestRow->remarks,
                'status' => $requestRow->status,
                'photo_path' => $requestRow->photo_path,
                'created_at' => optional($requestRow->created_at)?->toDateTimeString(),
            ])
            ->values();

        $recentIssueReports = IssueReport::query()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where('project_id', $submitToken->project_id)
            ->latest()
            ->take(5)
            ->get(['id', 'project_id', 'issue_title', 'description', 'severity', 'status', 'photo_path', 'created_at'])
            ->map(fn (IssueReport $issueRow) => [
                'id' => $issueRow->id,
                'project_id' => $issueRow->project_id,
                'issue_title' => $issueRow->issue_title,
                'description' => $issueRow->description,
                'severity' => $issueRow->severity,
                'status' => $issueRow->status,
                'photo_path' => $issueRow->photo_path,
                'created_at' => optional($issueRow->created_at)?->toDateTimeString(),
            ])
            ->values();

        $attendanceSavedByWeek = Attendance::query()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where('project_id', $submitToken->project_id)
            ->whereNotNull('date')
            ->orderBy('date')
            ->orderBy('worker_name')
            ->get(['worker_name', 'worker_role', 'date', 'hours', 'attendance_code'])
            ->groupBy(function (Attendance $attendance) {
                return Carbon::parse($attendance->date)->startOfWeek(Carbon::MONDAY)->toDateString();
            })
            ->map(function ($weekRows) {
                $workers = [];
                foreach ($weekRows as $row) {
                    $workerName = trim((string) $row->worker_name);
                    if ($workerName === '') {
                        continue;
                    }

                    $workerRole = trim((string) ($row->worker_role ?? 'Worker'));
                    $workerRole = $workerRole !== '' ? $workerRole : 'Worker';
                    $workerKey = Str::lower($workerName . '|' . $workerRole);

                    if (!isset($workers[$workerKey])) {
                        $workers[$workerKey] = [
                            'worker_name' => $workerName,
                            'worker_role' => $workerRole,
                            'days' => collect(self::ATTENDANCE_DAY_KEYS)->mapWithKeys(fn (string $dayKey) => [$dayKey => ''])->all(),
                        ];
                    }

                    $dayKey = Carbon::parse($row->date)->format('D');
                    $dayMap = [
                        'Mon' => 'mon',
                        'Tue' => 'tue',
                        'Wed' => 'wed',
                        'Thu' => 'thu',
                        'Fri' => 'fri',
                        'Sat' => 'sat',
                        'Sun' => 'sun',
                    ];
                    $resolvedDayKey = $dayMap[$dayKey] ?? null;
                    if ($resolvedDayKey === null) {
                        continue;
                    }

                    $storedStatus = strtoupper(trim((string) ($row->attendance_code ?? '')));
                    $workers[$workerKey]['days'][$resolvedDayKey] = in_array($storedStatus, array_keys(self::ATTENDANCE_STATUS_HOURS), true)
                        ? $storedStatus
                        : $this->statusFromHours((float) $row->hours);
                }

                return collect($workers)
                    ->sortBy(fn (array $worker) => Str::lower($worker['worker_name']))
                    ->values()
                    ->all();
            })
            ->all();

        $weeklySavedByWeek = WeeklyAccomplishment::query()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where('project_id', $submitToken->project_id)
            ->orderBy('week_start')
            ->orderBy('scope_of_work')
            ->get(['week_start', 'scope_of_work', 'percent_completed'])
            ->values();

        $foremanName = trim((string) ($submitToken->foreman->fullname ?? ''));
        $normalizedForemanName = Str::lower($foremanName);

        $projectScopes = ProjectScope::query()
            ->where('project_id', $submitToken->project_id)
            ->orderBy('scope_name')
            ->get(['id', 'scope_name', 'assigned_personnel'])
            ->filter(function (ProjectScope $scopeRow) use ($normalizedForemanName) {
                $assignedPersonnel = collect(preg_split('/[,;]+/', (string) ($scopeRow->assigned_personnel ?? '')))
                    ->map(fn ($name) => trim((string) $name))
                    ->filter(fn (string $name) => $name !== '')
                    ->map(fn (string $name) => Str::lower($name))
                    ->values();

                if ($assignedPersonnel->isEmpty()) {
                    return true;
                }

                if ($normalizedForemanName === '') {
                    return false;
                }

                return $assignedPersonnel->contains($normalizedForemanName);
            });

        $projectScopeNames = $projectScopes
            ->pluck('scope_name')
            ->map(fn ($scope) => trim((string) $scope))
            ->filter(fn (string $scope) => $scope !== '')
            ->unique(fn (string $scope) => Str::lower($scope))
            ->values();

        $weeklyScopeOfWorks = $projectScopeNames->isNotEmpty()
            ? $projectScopeNames->all()
            : self::WEEKLY_SCOPE_OF_WORKS;

        $weeklyScopeLookup = collect($weeklyScopeOfWorks)
            ->mapWithKeys(fn (string $scope) => [Str::lower($scope) => true])
            ->all();

        $weeklyScopePhotoMap = [];
        $projectScopesById = $projectScopes->keyBy(fn (ProjectScope $scope) => (int) $scope->id);

        if ($projectScopesById->isNotEmpty()) {
            $scopePhotos = ScopePhoto::query()
                ->whereIn('project_scope_id', $projectScopesById->keys()->all())
                ->orderByDesc('id')
                ->get(['id', 'project_scope_id', 'photo_path', 'caption', 'created_at']);

            foreach ($scopePhotos as $scopePhoto) {
                $projectScope = $projectScopesById->get((int) $scopePhoto->project_scope_id);
                if (!$projectScope) {
                    continue;
                }

                $scopeName = trim((string) ($projectScope->scope_name ?? ''));
                if ($scopeName === '') {
                    continue;
                }

                $scopeKey = Str::lower($scopeName);
                if (!isset($weeklyScopePhotoMap[$scopeKey])) {
                    $weeklyScopePhotoMap[$scopeKey] = [];
                }

                if (count($weeklyScopePhotoMap[$scopeKey]) >= 8) {
                    continue;
                }

                $weeklyScopePhotoMap[$scopeKey][] = [
                    'id' => (int) $scopePhoto->id,
                    'photo_path' => $scopePhoto->photo_path,
                    'caption' => $scopePhoto->caption,
                    'created_at' => optional($scopePhoto->created_at)?->toDateTimeString(),
                ];
            }
        }

        $weeklySavedByWeek = $weeklySavedByWeek
            ->groupBy(fn (WeeklyAccomplishment $row) => $row->week_start ? Carbon::parse($row->week_start)->toDateString() : '')
            ->map(function ($rows) use ($weeklyScopeLookup) {
                return $rows->map(function (WeeklyAccomplishment $row) use ($weeklyScopeLookup) {
                    $scope = trim((string) ($row->scope_of_work ?? ''));
                    $percentValue = $row->percent_completed;
                    $percent = $percentValue === null ? '' : (string) ((float) $percentValue + 0);
                    return [
                        'scope_of_work' => $scope,
                        'percent_completed' => $percent,
                        'is_manual' => !isset($weeklyScopeLookup[Str::lower($scope)]),
                    ];
                })->values()->all();
            })
            ->all();

        return Inertia::render('Public/ProgressSubmit', [
            'submitToken' => [
                'token' => $submitToken->token,
                'project_id' => $submitToken->project_id,
                'project_name' => $submitToken->project->name,
                'foreman_name' => $submitToken->foreman->fullname,
                'expires_at' => optional($submitToken->expires_at)?->toDateTimeString(),
                'workers' => $workers,
                'weekly_scope_of_works' => $weeklyScopeOfWorks,
                'weekly_scope_photo_map' => $weeklyScopePhotoMap,
                'photo_categories' => self::PHOTO_CATEGORIES,
                'recent_photos' => $recentPhotos,
                'recent_deliveries' => $recentDeliveries,
                'recent_material_requests' => $recentMaterialRequests,
                'recent_issue_reports' => $recentIssueReports,
                'attendance_saved_by_week' => $attendanceSavedByWeek,
                'weekly_saved_by_week' => $weeklySavedByWeek,
            ],
        ]);
    }

    public function receipt(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);
        $project = $submitToken->project;

        $scopes = $project->scopes()
            ->with(['photos' => fn ($query) => $query->latest('id')->limit(4)])
            ->orderBy('scope_name')
            ->get();

        $scopeRows = $scopes->map(function (ProjectScope $scope) {
            $progress = (float) ($scope->progress_percent ?? 0);
            $weight = (float) ($scope->weight_percent ?? 0);
            $contract = (float) ($scope->contract_amount ?? 0);
            $computedPercent = round($weight * $progress / 100, 2);
            $amountToDate = round($contract * min(100, $progress) / 100, 2);

            return [
                'id' => $scope->id,
                'scope_name' => $scope->scope_name,
                'contract_amount' => $contract,
                'weight_percent' => $weight,
                'progress_percent' => (int) $scope->progress_percent,
                'computed_percent' => $computedPercent,
                'amount_to_date' => $amountToDate,
                'start_date' => optional($scope->start_date)?->toDateString(),
                'target_completion' => optional($scope->target_completion)?->toDateString(),
                'assigned_personnel' => $scope->assigned_personnel,
                'photos' => $scope->photos->map(fn ($photo) => [
                    'id' => $photo->id,
                    'photo_path' => $photo->photo_path,
                    'caption' => $photo->caption,
                    'created_at' => optional($photo->created_at)?->toDateTimeString(),
                ])->values(),
            ];
        })->values();

        $issueTotals = IssueReport::query()
            ->where('project_id', $project->id)
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        $totals = [
            'contract_total' => round($scopeRows->sum('contract_amount'), 2),
            'weight_total' => round($scopeRows->sum('weight_percent'), 2),
            'weighted_progress_percent' => round($scopeRows->sum('computed_percent'), 2),
            'computed_amount_total' => round($scopeRows->sum('amount_to_date'), 2),
        ];

        return Inertia::render('Public/ProgressReceipt', [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'client' => $project->client,
                'phase' => $project->phase,
                'status' => $project->status,
            ],
            'foreman_name' => $submitToken->foreman->fullname ?? '',
            'scopes' => $scopeRows,
            'totals' => $totals,
            'issue_summary' => [
                'open' => $issueTotals['open'] ?? 0,
                'resolved' => $issueTotals['resolved'] ?? 0,
            ],
            'token' => $submitToken->token,
            'expires_at' => optional($submitToken->expires_at)?->toDateTimeString(),
        ]);
    }

    public function store(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'progress_note' => ['required', 'string', 'max:2000'],
            'photo' => ['required', 'image', 'max:10240'],
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $uploaded = $validated['photo'];
        $path = $uploaded->store('public-progress/' . $submitToken->project_id, 'public');
        $progressNote = trim((string) $validated['progress_note']);
        $caption = trim((string) ($validated['caption'] ?? ''));

        ProjectUpdate::create([
            'project_id' => $submitToken->project_id,
            'note' => $this->formattedProgressNote($submitToken->foreman->fullname, $progressNote, $caption),
            'created_by' => $submitToken->foreman_id,
        ]);

        ProjectFile::create([
            'project_id' => $submitToken->project_id,
            'file_path' => $path,
            'original_name' => $this->submittedPhotoName($uploaded->getClientOriginalExtension()),
            'uploaded_by' => $submitToken->foreman_id,
        ]);

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', 'Progress submitted successfully.');
    }

    public function storeAll(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $rules = [
            'attendance_week_start' => ['nullable', 'date'],
            'attendance_entries' => ['nullable', 'array'],
            'attendance_entries.*.worker_name' => ['nullable', 'string', 'max:255'],
            'attendance_entries.*.worker_role' => ['nullable', 'string', 'max:120'],
            'attendance_entries.*.days' => ['nullable', 'array'],

            'delivery_date' => ['nullable', 'date'],
            'delivery_status' => ['nullable', Rule::in(['complete', 'incomplete'])],
            'delivery_item_delivered' => ['nullable', 'string', 'max:255'],
            'delivery_quantity' => ['nullable', 'string', 'max:120'],
            'delivery_supplier' => ['nullable', 'string', 'max:255'],
            'delivery_note' => ['nullable', 'string', 'max:500'],
            'delivery_photo' => ['nullable', 'image', 'max:10240'],

            'material_name' => ['nullable', 'string', 'max:255'],
            'material_quantity' => ['nullable', 'string', 'max:120'],
            'material_unit' => ['nullable', 'string', 'max:120'],
            'material_remarks' => ['nullable', 'string', 'max:1000'],
            'material_photo' => ['nullable', 'image', 'max:10240'],

            'weekly_week_start' => ['nullable', 'date'],
            'weekly_scopes' => ['nullable', 'array'],
            'weekly_scopes.*.scope_of_work' => ['nullable', 'string', 'max:255'],
            'weekly_scopes.*.percent_completed' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'weekly_scopes.*.photo_caption' => ['nullable', 'string', 'max:255'],
            'weekly_scopes.*.photos' => ['nullable', 'array'],
            'weekly_scopes.*.photos.*' => ['nullable', 'image', 'max:10240'],
            'weekly_removed_scopes' => ['nullable', 'array'],
            'weekly_removed_scopes.*' => ['nullable', 'string', 'max:255'],

            'photo_file' => ['nullable', 'image', 'max:10240'],
            'photo_category' => ['nullable', Rule::in(self::PHOTO_CATEGORIES)],
            'photo_description' => ['nullable', 'string', 'max:1000'],

            'issue_title' => ['nullable', 'string', 'max:255'],
            'issue_description' => ['nullable', 'string', 'max:2000'],
            'issue_urgency' => ['nullable', Rule::in(['low', 'normal', 'high'])],
            'issue_photo' => ['nullable', 'image', 'max:10240'],
        ];

        foreach (self::ATTENDANCE_DAY_KEYS as $dayKey) {
            $rules["attendance_entries.*.days.{$dayKey}"] = ['nullable', Rule::in(array_keys(self::ATTENDANCE_STATUS_HOURS))];
        }

        $validated = $request->validate($rules);
        $submittedAny = false;

        $attendanceEntries = collect($validated['attendance_entries'] ?? [])
            ->map(function (array $entry) {
                $workerName = trim((string) ($entry['worker_name'] ?? ''));
                $workerRole = trim((string) ($entry['worker_role'] ?? ''));
                $days = [];
                foreach (self::ATTENDANCE_DAY_KEYS as $dayKey) {
                    $days[$dayKey] = strtoupper(trim((string) (($entry['days'][$dayKey] ?? ''))));
                }

                return [
                    'worker_name' => $workerName,
                    'worker_role' => $workerRole !== '' ? $workerRole : 'Worker',
                    'days' => $days,
                ];
            })
            ->filter(fn (array $row) => $row['worker_name'] !== '' && collect($row['days'])->contains(fn ($status) => $status !== ''))
            ->values();

        if ($attendanceEntries->isNotEmpty()) {
            $attendanceWeekStart = trim((string) ($validated['attendance_week_start'] ?? ''));
            if ($attendanceWeekStart === '') {
                throw ValidationException::withMessages([
                    'attendance_week_start' => 'Week start is required when submitting attendance.',
                ]);
            }

            $this->syncWorkersFromAttendanceEntries($submitToken, $attendanceEntries);

            $weekStart = Carbon::parse($attendanceWeekStart)->startOfWeek(Carbon::MONDAY);

            foreach ($attendanceEntries as $entry) {
                foreach (self::ATTENDANCE_DAY_KEYS as $dayKey) {
                    $status = $entry['days'][$dayKey] ?? '';
                    if ($status === '') {
                        continue;
                    }

                    $date = $weekStart->copy()->addDays(self::ATTENDANCE_DAY_OFFSETS[$dayKey])->toDateString();
                    $hours = (float) (self::ATTENDANCE_STATUS_HOURS[$status] ?? 0);

                    Attendance::updateOrCreate(
                        [
                            'foreman_id' => $submitToken->foreman_id,
                            'project_id' => $submitToken->project_id,
                            'worker_name' => $entry['worker_name'],
                            'worker_role' => $entry['worker_role'],
                            'date' => $date,
                        ],
                        [
                            'hours' => $hours,
                            'attendance_code' => $status,
                            'time_in' => null,
                            'time_out' => null,
                            'selfie_path' => null,
                        ]
                    );
                }
            }

            $submittedAny = true;
        }

        $deliveryTouched = $this->hasAnyText([
            $validated['delivery_date'] ?? null,
            $validated['delivery_status'] ?? null,
            $validated['delivery_item_delivered'] ?? null,
            $validated['delivery_quantity'] ?? null,
            $validated['delivery_supplier'] ?? null,
            $validated['delivery_note'] ?? null,
        ]) || isset($validated['delivery_photo']);

        if ($deliveryTouched) {
            $deliveryDate = trim((string) ($validated['delivery_date'] ?? ''));
            $deliveryStatus = trim((string) ($validated['delivery_status'] ?? ''));

            if ($deliveryDate === '' || $deliveryStatus === '') {
                throw ValidationException::withMessages([
                    'delivery_date' => 'Delivery date and status are required when submitting delivery confirmation.',
                ]);
            }

            $status = $deliveryStatus === 'complete' ? 'received' : 'incomplete';
            $itemDelivered = trim((string) ($validated['delivery_item_delivered'] ?? ''));
            $quantity = trim((string) ($validated['delivery_quantity'] ?? ''));
            $deliveryPhotoPath = null;
            $note = trim((string) ($validated['delivery_note'] ?? ''));

            if (isset($validated['delivery_photo'])) {
                $deliveryPhotoPath = $validated['delivery_photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
            }

            DeliveryConfirmation::create([
                'project_id' => $submitToken->project_id,
                'foreman_id' => $submitToken->foreman_id,
                'item_delivered' => $itemDelivered !== '' ? $itemDelivered : 'Delivery Confirmation',
                'quantity' => $quantity !== '' ? $quantity : '1',
                'delivery_date' => $deliveryDate,
                'supplier' => trim((string) ($validated['delivery_supplier'] ?? '')) ?: null,
                'status' => $status,
                'photo_path' => $deliveryPhotoPath,
            ]);

            if ($deliveryPhotoPath !== null) {
                $caption = '[Delivery] ' . ($status === 'received' ? 'Complete' : 'Incomplete');
                if ($note !== '') {
                    $caption .= ' - ' . $note;
                }

                ProgressPhoto::create([
                    'foreman_id' => $submitToken->foreman_id,
                    'project_id' => $submitToken->project_id,
                    'photo_path' => $deliveryPhotoPath,
                    'caption' => $caption,
                ]);
            }

            $submittedAny = true;
        }

        $materialTouched = $this->hasAnyText([
            $validated['material_name'] ?? null,
            $validated['material_quantity'] ?? null,
            $validated['material_unit'] ?? null,
            $validated['material_remarks'] ?? null,
        ]) || isset($validated['material_photo']);

        if ($materialTouched) {
            $materialName = trim((string) ($validated['material_name'] ?? ''));
            $materialQuantity = trim((string) ($validated['material_quantity'] ?? ''));
            $materialUnit = trim((string) ($validated['material_unit'] ?? ''));

            if ($materialName === '' || $materialQuantity === '' || $materialUnit === '') {
                throw ValidationException::withMessages([
                    'material_name' => 'Material name, quantity, and unit are required when submitting a material request.',
                ]);
            }

            $materialPhotoPath = null;
            if (isset($validated['material_photo'])) {
                $materialPhotoPath = $validated['material_photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
            }

            MaterialRequest::create([
                'project_id' => $submitToken->project_id,
                'foreman_id' => $submitToken->foreman_id,
                'material_name' => $materialName,
                'quantity' => $materialQuantity,
                'unit' => $materialUnit,
                'remarks' => trim((string) ($validated['material_remarks'] ?? '')) ?: null,
                'status' => 'pending',
                'photo_path' => $materialPhotoPath,
            ]);

            if ($materialPhotoPath !== null) {
                $caption = '[Material] ' . $materialName;
                $remarks = trim((string) ($validated['material_remarks'] ?? ''));
                if ($remarks !== '') {
                    $caption .= ' - ' . $remarks;
                }

                ProgressPhoto::create([
                    'foreman_id' => $submitToken->foreman_id,
                    'project_id' => $submitToken->project_id,
                    'photo_path' => $materialPhotoPath,
                    'caption' => $caption,
                ]);
            }

            $submittedAny = true;
        }

        $weeklyScopes = collect($validated['weekly_scopes'] ?? [])
            ->map(function (array $scope) {
                return [
                    'scope_of_work' => trim((string) ($scope['scope_of_work'] ?? '')),
                    'percent_completed' => trim((string) ($scope['percent_completed'] ?? '')),
                    'photo_caption' => trim((string) ($scope['photo_caption'] ?? '')),
                    'photos' => collect($scope['photos'] ?? [])
                        ->filter(fn ($photo) => $photo instanceof UploadedFile)
                        ->values()
                        ->all(),
                ];
            })
            ->filter(fn (array $scope) => $scope['scope_of_work'] !== '' && $scope['percent_completed'] !== '')
            ->values();

        $weeklyScopePhotos = collect($validated['weekly_scopes'] ?? [])
            ->map(function (array $scope) {
                return [
                    'scope_of_work' => trim((string) ($scope['scope_of_work'] ?? '')),
                    'photo_caption' => trim((string) ($scope['photo_caption'] ?? '')),
                    'photos' => collect($scope['photos'] ?? [])
                        ->filter(fn ($photo) => $photo instanceof UploadedFile)
                        ->values()
                        ->all(),
                ];
            })
            ->filter(fn (array $scope) => $scope['scope_of_work'] !== '' && count($scope['photos']) > 0)
            ->values();

        $weeklyRemovedScopes = collect($validated['weekly_removed_scopes'] ?? [])
            ->map(fn ($scope) => trim((string) $scope))
            ->filter(fn (string $scope) => $scope !== '')
            ->unique(fn (string $scope) => Str::lower($scope))
            ->values();

        if ($weeklyScopes->isNotEmpty() || $weeklyRemovedScopes->isNotEmpty() || $weeklyScopePhotos->isNotEmpty()) {
            $weeklyWeekStart = trim((string) ($validated['weekly_week_start'] ?? ''));
            if ($weeklyWeekStart === '') {
                throw ValidationException::withMessages([
                    'weekly_week_start' => 'Week start is required when submitting weekly progress.',
                ]);
            }

            $weekStart = Carbon::parse($weeklyWeekStart)->startOfWeek(Carbon::MONDAY)->toDateString();
            $submittedScopeKeys = $weeklyScopes
                ->pluck('scope_of_work')
                ->map(fn (string $scope) => Str::lower($scope))
                ->values();
            $scopesToDelete = $weeklyRemovedScopes
                ->filter(fn (string $scope) => !$submittedScopeKeys->contains(Str::lower($scope)))
                ->values();

            if ($scopesToDelete->isNotEmpty()) {
                WeeklyAccomplishment::query()
                    ->where('foreman_id', $submitToken->foreman_id)
                    ->where('project_id', $submitToken->project_id)
                    ->whereDate('week_start', $weekStart)
                    ->whereIn('scope_of_work', $scopesToDelete->all())
                    ->delete();
            }

            foreach ($weeklyScopes as $scope) {
                WeeklyAccomplishment::updateOrCreate(
                    [
                        'foreman_id' => $submitToken->foreman_id,
                        'project_id' => $submitToken->project_id,
                        'week_start' => $weekStart,
                        'scope_of_work' => $scope['scope_of_work'],
                    ],
                    [
                        'percent_completed' => (float) $scope['percent_completed'],
                    ]
                );
            }

            $this->syncProjectScopesFromWeeklyEntries(
                $submitToken->project_id,
                trim((string) ($submitToken->foreman->fullname ?? '')),
                $weeklyScopes->all()
            );
            $this->storeScopePhotosFromWeeklyEntries(
                $submitToken->project_id,
                $weeklyScopePhotos->all(),
                $weekStart,
                trim((string) ($submitToken->foreman->fullname ?? ''))
            );
            $this->syncProjectOverallProgressFromWeekly($submitToken->project_id);
            $submittedAny = true;
        }

        $photoTouched = isset($validated['photo_file']) || $this->hasAnyText([
            $validated['photo_category'] ?? null,
            $validated['photo_description'] ?? null,
        ]);

        if ($photoTouched) {
            if (!isset($validated['photo_file'])) {
                throw ValidationException::withMessages([
                    'photo_file' => 'Photo file is required when submitting photo details.',
                ]);
            }

            $path = $validated['photo_file']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
            $category = trim((string) ($validated['photo_category'] ?? ''));
            $description = trim((string) ($validated['photo_description'] ?? ''));
            $captionParts = [];
            if ($category !== '') {
                $captionParts[] = '[' . $category . ']';
            }
            if ($description !== '') {
                $captionParts[] = $description;
            }
            $caption = count($captionParts) > 0 ? implode(' ', $captionParts) : 'Public photo upload';

            ProgressPhoto::create([
                'foreman_id' => $submitToken->foreman_id,
                'project_id' => $submitToken->project_id,
                'photo_path' => $path,
                'caption' => $caption,
            ]);

            $submittedAny = true;
        }

        $issueTouched = isset($validated['issue_photo']) || $this->hasAnyText([
            $validated['issue_title'] ?? null,
            $validated['issue_description'] ?? null,
        ]);

        if ($issueTouched) {
            $issueTitle = trim((string) ($validated['issue_title'] ?? ''));
            $issueDescription = trim((string) ($validated['issue_description'] ?? ''));
            $issueUrgency = trim((string) ($validated['issue_urgency'] ?? 'normal'));

            if ($issueTitle === '' || $issueDescription === '') {
                throw ValidationException::withMessages([
                    'issue_title' => 'Issue title and description are required when submitting an issue report.',
                ]);
            }

            $severity = $issueUrgency === 'normal' ? 'medium' : $issueUrgency;
            $issuePhotoPath = null;
            if (isset($validated['issue_photo'])) {
                $issuePhotoPath = $validated['issue_photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
            }

            IssueReport::create([
                'project_id' => $submitToken->project_id,
                'foreman_id' => $submitToken->foreman_id,
                'issue_title' => $issueTitle,
                'description' => $issueDescription,
                'severity' => $severity,
                'status' => 'open',
                'photo_path' => $issuePhotoPath,
            ]);

            if ($issuePhotoPath !== null) {
                ProgressPhoto::create([
                    'foreman_id' => $submitToken->foreman_id,
                    'project_id' => $submitToken->project_id,
                    'photo_path' => $issuePhotoPath,
                    'caption' => '[Issue] ' . $issueTitle,
                ]);
            }

            $submittedAny = true;
        }

        if (!$submittedAny) {
            throw ValidationException::withMessages([
                'submit_all' => 'Fill at least one section before submitting.',
            ]);
        }

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', 'Jotform submitted successfully.');
    }

    public function storeAttendance(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $rules = [
            'week_start' => ['required', 'date'],
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.worker_name' => ['required', 'string', 'max:255'],
            'entries.*.worker_role' => ['nullable', 'string', 'max:120'],
            'entries.*.days' => ['required', 'array'],
        ];

        foreach (self::ATTENDANCE_DAY_KEYS as $dayKey) {
            $rules["entries.*.days.{$dayKey}"] = ['nullable', Rule::in(array_keys(self::ATTENDANCE_STATUS_HOURS))];
        }

        $validated = $request->validate($rules);
        $weekStart = Carbon::parse($validated['week_start'])->startOfWeek(Carbon::MONDAY);
        $entries = collect($validated['entries']);
        $this->syncWorkersFromAttendanceEntries($submitToken, $entries);

        foreach ($validated['entries'] as $entry) {
            $workerName = trim((string) $entry['worker_name']);
            if ($workerName === '') {
                continue;
            }

            $workerRole = trim((string) ($entry['worker_role'] ?? 'Worker'));
            foreach (self::ATTENDANCE_DAY_KEYS as $dayKey) {
                $status = strtoupper(trim((string) ($entry['days'][$dayKey] ?? '')));
                if ($status === '') {
                    continue;
                }

                $date = $weekStart->copy()->addDays(self::ATTENDANCE_DAY_OFFSETS[$dayKey])->toDateString();
                $hours = (float) (self::ATTENDANCE_STATUS_HOURS[$status] ?? 0);

                Attendance::updateOrCreate(
                    [
                        'foreman_id' => $submitToken->foreman_id,
                        'project_id' => $submitToken->project_id,
                        'worker_name' => $workerName,
                        'worker_role' => $workerRole !== '' ? $workerRole : 'Worker',
                        'date' => $date,
                    ],
                    [
                        'hours' => $hours,
                        'attendance_code' => $status,
                        'time_in' => null,
                        'time_out' => null,
                        'selfie_path' => null,
                    ]
                );
            }
        }

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', 'Attendance submitted.');
    }

    public function storeDelivery(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'delivery_date' => ['required', 'date'],
            'status' => ['required', Rule::in(['complete', 'incomplete'])],
            'item_delivered' => ['nullable', 'string', 'max:255'],
            'quantity' => ['nullable', 'string', 'max:120'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'photo' => ['nullable', 'image', 'max:10240'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $status = $validated['status'] === 'complete' ? 'received' : 'incomplete';
        $itemDelivered = trim((string) ($validated['item_delivered'] ?? ''));
        $quantity = trim((string) ($validated['quantity'] ?? ''));
        $deliveryPhotoPath = null;
        $note = trim((string) ($validated['note'] ?? ''));

        if (isset($validated['photo'])) {
            $deliveryPhotoPath = $validated['photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
        }

        DeliveryConfirmation::create([
            'project_id' => $submitToken->project_id,
            'foreman_id' => $submitToken->foreman_id,
            'item_delivered' => $itemDelivered !== '' ? $itemDelivered : 'Delivery Confirmation',
            'quantity' => $quantity !== '' ? $quantity : '1',
            'delivery_date' => $validated['delivery_date'],
            'supplier' => trim((string) ($validated['supplier'] ?? '')) ?: null,
            'status' => $status,
            'photo_path' => $deliveryPhotoPath,
        ]);

        if ($deliveryPhotoPath !== null) {
            $caption = '[Delivery] ' . ($status === 'received' ? 'Complete' : 'Incomplete');
            if ($note !== '') {
                $caption .= ' - ' . $note;
            }

            ProgressPhoto::create([
                'foreman_id' => $submitToken->foreman_id,
                'project_id' => $submitToken->project_id,
                'photo_path' => $deliveryPhotoPath,
                'caption' => $caption,
            ]);
        }

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', 'Delivery confirmation submitted.');
    }

    public function storeMaterialRequest(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'material_name' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'string', 'max:120'],
            'unit' => ['required', 'string', 'max:120'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'photo' => ['nullable', 'image', 'max:10240'],
        ]);

        $materialPhotoPath = null;
        if (isset($validated['photo'])) {
            $materialPhotoPath = $validated['photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
        }

        MaterialRequest::create([
            'project_id' => $submitToken->project_id,
            'foreman_id' => $submitToken->foreman_id,
            'material_name' => trim((string) $validated['material_name']),
            'quantity' => trim((string) $validated['quantity']),
            'unit' => trim((string) $validated['unit']),
            'remarks' => trim((string) ($validated['remarks'] ?? '')) ?: null,
            'status' => 'pending',
            'photo_path' => $materialPhotoPath,
        ]);

        if ($materialPhotoPath !== null) {
            $caption = '[Material] ' . trim((string) $validated['material_name']);
            $remarks = trim((string) ($validated['remarks'] ?? ''));
            if ($remarks !== '') {
                $caption .= ' - ' . $remarks;
            }

            ProgressPhoto::create([
                'foreman_id' => $submitToken->foreman_id,
                'project_id' => $submitToken->project_id,
                'photo_path' => $materialPhotoPath,
                'caption' => $caption,
            ]);
        }

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', 'Material request submitted.');
    }

    public function storeWeeklyProgress(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'week_start' => ['required', 'date'],
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*.scope_of_work' => ['required', 'string', 'max:255'],
            'scopes.*.percent_completed' => ['required', 'numeric', 'min:0', 'max:100'],
            'scopes.*.photo_caption' => ['nullable', 'string', 'max:255'],
            'scopes.*.photos' => ['nullable', 'array'],
            'scopes.*.photos.*' => ['nullable', 'image', 'max:10240'],
        ]);

        $weekStart = Carbon::parse($validated['week_start'])
            ->startOfWeek(Carbon::MONDAY)
            ->toDateString();

        foreach ($validated['scopes'] as $scope) {
            $scopeName = trim((string) ($scope['scope_of_work'] ?? ''));
            if ($scopeName === '') {
                continue;
            }

            WeeklyAccomplishment::updateOrCreate(
                [
                    'foreman_id' => $submitToken->foreman_id,
                    'project_id' => $submitToken->project_id,
                    'week_start' => $weekStart,
                    'scope_of_work' => $scopeName,
                ],
                [
                    'percent_completed' => (float) $scope['percent_completed'],
                ]
            );
        }

        $this->syncProjectScopesFromWeeklyEntries(
            $submitToken->project_id,
            trim((string) ($submitToken->foreman->fullname ?? '')),
            $validated['scopes']
        );
        $this->storeScopePhotosFromWeeklyEntries(
            $submitToken->project_id,
            $validated['scopes'],
            $weekStart,
            trim((string) ($submitToken->foreman->fullname ?? ''))
        );
        $this->syncProjectOverallProgressFromWeekly($submitToken->project_id);
        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', 'Weekly progress submitted.');
    }

    public function storePhoto(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'photo' => ['required', 'image', 'max:10240'],
            'category' => ['nullable', Rule::in(self::PHOTO_CATEGORIES)],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $path = $validated['photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
        $category = trim((string) ($validated['category'] ?? ''));
        $description = trim((string) ($validated['description'] ?? ''));
        $captionParts = [];
        if ($category !== '') {
            $captionParts[] = '[' . $category . ']';
        }
        if ($description !== '') {
            $captionParts[] = $description;
        }
        $caption = count($captionParts) > 0 ? implode(' ', $captionParts) : 'Public photo upload';

        ProgressPhoto::create([
            'foreman_id' => $submitToken->foreman_id,
            'project_id' => $submitToken->project_id,
            'photo_path' => $path,
            'caption' => $caption,
        ]);

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', 'Photo uploaded.');
    }

    public function storeIssueReport(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'issue_title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:2000'],
            'urgency' => ['required', Rule::in(['low', 'normal', 'high'])],
            'photo' => ['nullable', 'image', 'max:10240'],
        ]);

        $severity = $validated['urgency'] === 'normal'
            ? 'medium'
            : $validated['urgency'];

        $issuePhotoPath = null;
        if (isset($validated['photo'])) {
            $issuePhotoPath = $validated['photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
        }

        IssueReport::create([
            'project_id' => $submitToken->project_id,
            'foreman_id' => $submitToken->foreman_id,
            'issue_title' => trim((string) $validated['issue_title']),
            'description' => trim((string) $validated['description']),
            'severity' => $severity,
            'status' => 'open',
            'photo_path' => $issuePhotoPath,
        ]);

        if ($issuePhotoPath !== null) {
            ProgressPhoto::create([
                'foreman_id' => $submitToken->foreman_id,
                'project_id' => $submitToken->project_id,
                'photo_path' => $issuePhotoPath,
                'caption' => '[Issue] ' . trim((string) $validated['issue_title']),
            ]);
        }

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', 'Issue report submitted.');
    }

    private function resolveActiveToken(string $token): ProgressSubmitToken
    {
        $submitToken = ProgressSubmitToken::query()
            ->with(['project:id,name', 'foreman:id,fullname'])
            ->where('token', $token)
            ->firstOrFail();

        abort_unless($submitToken->isActive(), 404);

        return $submitToken;
    }

    private function formattedProgressNote(string $foremanName, string $progressNote, string $caption): string
    {
        $captionLine = $caption !== '' ? "\nCaption: {$caption}" : '';

        return "[Public Progress Submit]\n"
            . "Foreman: {$foremanName}\n"
            . "Note: {$progressNote}{$captionLine}";
    }

    private function hasAnyText(array $values): bool
    {
        foreach ($values as $value) {
            if (trim((string) ($value ?? '')) !== '') {
                return true;
            }
        }

        return false;
    }

    private function submittedPhotoName(string $extension): string
    {
        $safeExtension = $extension !== '' ? strtolower($extension) : 'jpg';
        $timestamp = now()->format('Ymd_His');
        $random = Str::lower(Str::random(6));

        return "public_progress_{$timestamp}_{$random}.{$safeExtension}";
    }

    private function statusFromHours(float $hours): string
    {
        if ($hours >= 7.5) {
            return 'P';
        }

        if ($hours >= 3.5) {
            return 'H';
        }

        return 'A';
    }

    private function syncWorkersFromAttendanceEntries(ProgressSubmitToken $submitToken, iterable $attendanceEntries): void
    {
        $normalizedNames = collect($attendanceEntries)
            ->map(fn ($entry) => trim((string) (($entry['worker_name'] ?? ''))))
            ->filter(fn (string $name) => $name !== '')
            ->unique(fn (string $name) => Str::lower($name))
            ->values();

        foreach ($normalizedNames as $workerName) {
            $worker = Worker::query()
                ->where('foreman_id', $submitToken->foreman_id)
                ->whereRaw('LOWER(name) = ?', [Str::lower($workerName)])
                ->first();

            if (!$worker) {
                Worker::create([
                    'foreman_id' => $submitToken->foreman_id,
                    'project_id' => $submitToken->project_id,
                    'name' => $workerName,
                ]);
                continue;
            }

            if ($worker->project_id === null) {
                $worker->project_id = $submitToken->project_id;
                $worker->save();
            }
        }
    }

    private function storeScopePhotosFromWeeklyEntries(
        int $projectId,
        iterable $weeklyScopes,
        ?string $weekStart = null,
        string $fallbackAssignee = ''
    ): void
    {
        if ($projectId <= 0) {
            return;
        }

        $assignee = trim($fallbackAssignee);
        $projectScopeRows = ProjectScope::query()
            ->where('project_id', $projectId)
            ->get(['id', 'scope_name'])
            ->filter(fn (ProjectScope $scope) => trim((string) ($scope->scope_name ?? '')) !== '')
            ->keyBy(fn (ProjectScope $scope) => Str::lower(trim((string) $scope->scope_name)));

        foreach ($weeklyScopes as $scope) {
            $scopeName = trim((string) ($scope['scope_of_work'] ?? ''));
            if ($scopeName === '') {
                continue;
            }

            $projectScope = $projectScopeRows->get(Str::lower($scopeName));
            if (!$projectScope) {
                $projectScope = ProjectScope::query()->create([
                    'project_id' => $projectId,
                    'scope_name' => $scopeName,
                    'assigned_personnel' => $assignee !== '' ? $assignee : null,
                    'progress_percent' => 0,
                    'status' => 'NOT_STARTED',
                    'remarks' => null,
                ]);

                $projectScopeRows->put(Str::lower($scopeName), $projectScope);
            }

            $uploadedPhotos = collect($scope['photos'] ?? [])
                ->filter(fn ($photo) => $photo instanceof UploadedFile)
                ->values();

            if ($uploadedPhotos->isEmpty()) {
                continue;
            }

            $photoCaption = trim((string) ($scope['photo_caption'] ?? ''));

            foreach ($uploadedPhotos as $photo) {
                $path = $photo->store('scope-photos/' . $projectScope->id, 'public');

                ScopePhoto::query()->create([
                    'project_scope_id' => $projectScope->id,
                    'photo_path' => $path,
                    'caption' => $this->weeklyScopePhotoCaption($scopeName, $photoCaption, $weekStart),
                ]);
            }
        }
    }

    private function weeklyScopePhotoCaption(string $scopeName, string $photoCaption, ?string $weekStart): string
    {
        $parts = ['[Jotform Weekly]'];
        if ($weekStart !== null && trim($weekStart) !== '') {
            $parts[] = 'Week: ' . trim($weekStart);
        }
        $parts[] = 'Scope: ' . trim($scopeName);
        if ($photoCaption !== '') {
            $parts[] = $photoCaption;
        }

        return implode(' | ', $parts);
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
}
