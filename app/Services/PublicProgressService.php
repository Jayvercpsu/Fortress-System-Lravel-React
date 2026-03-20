<?php

namespace App\Services;

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
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Models\Worker;
use App\Repositories\Contracts\ForemanProgressRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PublicProgressService
{
    public function __construct(
        private readonly ForemanProgressRepositoryInterface $foremanProgressRepository
    ) {
    }

    public function show(string $token)
    {
        $submitToken = $this->resolveActiveToken($token);
        $workerRows = $this->foremanProgressRepository->workers()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where(function ($query) use ($submitToken) {
                $query->whereNull('project_id')->orWhere('project_id', $submitToken->project_id);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'job_type']);

        $workerRoleLookup = $workerRows
            ->mapWithKeys(fn (Worker $worker) => [
                Str::lower(trim((string) $worker->name)) => trim((string) ($worker->job_type ?: Worker::JOB_TYPE_WORKER)) ?: Worker::JOB_TYPE_WORKER,
            ])
            ->all();

        $workers = $workerRows
            ->map(fn (Worker $worker) => [
                'id' => $worker->id,
                'name' => $worker->name,
                'role' => trim((string) ($worker->job_type ?: Worker::JOB_TYPE_WORKER)) ?: Worker::JOB_TYPE_WORKER,
            ])
            ->values();

        $recentPhotos = $this->foremanProgressRepository->progressPhotos()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where('project_id', $submitToken->project_id)
            ->where(function ($query) {
                $query->whereNull('caption')
                    ->orWhere(function ($inner) {
                        $inner->where('caption', 'not like', '[Material]%')
                            ->where('caption', 'not like', '[Delivery]%')
                            ->where('caption', 'not like', '[Issue]%');
                    });
            })
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

        $recentDeliveries = $this->foremanProgressRepository->deliveries()
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

        $recentMaterialRequests = $this->foremanProgressRepository->materialRequests()
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

        $recentIssueReports = $this->foremanProgressRepository->issueReports()
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

        $attendanceSavedByWeek = $this->foremanProgressRepository->attendances()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where('project_id', $submitToken->project_id)
            ->whereNotNull('date')
            ->orderBy('date')
            ->orderBy('worker_name')
            ->get(['worker_name', 'worker_role', 'date', 'hours', 'attendance_code'])
            ->groupBy(function (Attendance $attendance) {
                return Carbon::parse($attendance->date)->startOfWeek(Carbon::MONDAY)->toDateString();
            })
            ->map(function ($weekRows) use ($workerRoleLookup) {
                $workers = [];
                foreach ($weekRows as $row) {
                    $workerName = trim((string) $row->worker_name);
                    if ($workerName === '') {
                        continue;
                    }

                    $workerRole = trim((string) ($row->worker_role ?? Worker::JOB_TYPE_WORKER));
                    $workerRole = $workerRole !== '' ? $workerRole : Worker::JOB_TYPE_WORKER;
                    $lookupKey = Str::lower($workerName);
                    if (isset($workerRoleLookup[$lookupKey])) {
                        $workerRole = $workerRoleLookup[$lookupKey];
                    }
                    if ($this->isForemanRole($workerRole)) {
                        continue;
                    }
                    $workerKey = Str::lower($workerName . '|' . $workerRole);

                    if (!isset($workers[$workerKey])) {
                        $workers[$workerKey] = [
                            'worker_name' => $workerName,
                            'worker_role' => $workerRole,
                            'days' => collect(Attendance::DAY_KEYS)->mapWithKeys(fn (string $dayKey) => [$dayKey => ''])->all(),
                        ];
                    }

                    $dayKey = Carbon::parse($row->date)->format('D');
                    $resolvedDayKey = Attendance::WEEKDAY_SHORT_TO_KEY[$dayKey] ?? null;
                    if ($resolvedDayKey === null) {
                        continue;
                    }

                    $storedStatus = strtoupper(trim((string) ($row->attendance_code ?? '')));
                    $workers[$workerKey]['days'][$resolvedDayKey] = in_array($storedStatus, array_keys(Attendance::STATUS_HOURS), true)
                        ? $storedStatus
                        : $this->statusFromHours((float) $row->hours);
                }

                return collect($workers)
                    ->sortBy(fn (array $worker) => Str::lower($worker['worker_name']))
                    ->values()
                    ->all();
            })
            ->all();

        $weeklySavedByWeek = $this->foremanProgressRepository->weeklyAccomplishments()
            ->where('foreman_id', $submitToken->foreman_id)
            ->where('project_id', $submitToken->project_id)
            ->orderBy('week_start')
            ->orderBy('scope_of_work')
            ->get(['week_start', 'scope_of_work', 'percent_completed'])
            ->values();

        $weeklySavedScopeKeys = $weeklySavedByWeek
            ->map(fn (WeeklyAccomplishment $row) => Str::lower(trim((string) ($row->scope_of_work ?? ''))))
            ->filter(fn (string $scope) => $scope !== '')
            ->unique()
            ->values();

        $foremanName = trim((string) ($submitToken->foreman->fullname ?? ''));
        $normalizedForemanName = Str::lower($foremanName);

        $projectScopeRows = $this->foremanProgressRepository->projectScopes()
            ->where('project_id', $submitToken->project_id)
            ->orderBy('scope_name')
            ->get(['id', 'scope_name', 'assigned_personnel']);

        $assignedPersonnelForScope = function (ProjectScope $scopeRow) {
            return collect(preg_split('/[,;]+/', (string) ($scopeRow->assigned_personnel ?? '')))
                ->map(fn ($name) => trim((string) $name))
                ->filter(fn (string $name) => $name !== '')
                ->map(fn (string $name) => Str::lower($name))
                ->values();
        };

        $projectScopes = $projectScopeRows
            ->filter(function (ProjectScope $scopeRow) use ($normalizedForemanName, $assignedPersonnelForScope) {
                $assignedPersonnel = collect(preg_split('/[,;]+/', (string) ($scopeRow->assigned_personnel ?? '')))
                    ->map(fn ($name) => trim((string) $name))
                    ->filter(fn (string $name) => $name !== '')
                    ->map(fn (string $name) => Str::lower($name))
                    ->values();

                if ($assignedPersonnel->isEmpty()) {
                    return false;
                }

                if ($normalizedForemanName === '') {
                    return false;
                }

                return $assignedPersonnel->contains($normalizedForemanName);
            });

        $projectScopesForPhotos = $projectScopeRows
            ->filter(function (ProjectScope $scopeRow) use ($normalizedForemanName, $weeklySavedScopeKeys, $assignedPersonnelForScope) {
                $scopeName = Str::lower(trim((string) ($scopeRow->scope_name ?? '')));
                if ($scopeName !== '' && $weeklySavedScopeKeys->contains($scopeName)) {
                    return true;
                }

                $assignedPersonnel = $assignedPersonnelForScope($scopeRow);
                if ($assignedPersonnel->isEmpty()) {
                    return false;
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

        $weeklyScopeDefaultsEnabled = $projectScopeRows->isEmpty();
        $weeklyScopeOfWorks = $projectScopeNames->isNotEmpty()
            ? $projectScopeNames->all()
            : ($weeklyScopeDefaultsEnabled ? WeeklyAccomplishment::defaultScopeOfWorks() : []);

        $weeklyScopeLookup = collect($weeklyScopeOfWorks)
            ->mapWithKeys(fn (string $scope) => [Str::lower($scope) => true])
            ->all();

        $weeklyScopePhotoMap = [];
        $projectScopesById = $projectScopesForPhotos->keyBy(fn (ProjectScope $scope) => (int) $scope->id);

        if ($projectScopesById->isNotEmpty()) {
            $scopePhotos = $this->foremanProgressRepository->scopePhotos()
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

                $weeklyScopePhotoMap[$scopeKey][] = [
                    'id' => (int) $scopePhoto->id,
                    'photo_path' => $scopePhoto->photo_path,
                    'caption' => $scopePhoto->caption,
                    'created_at' => optional($scopePhoto->created_at)?->toDateTimeString(),
                    'week_start' => $this->extractWeekStartFromScopePhoto($scopePhoto->caption),
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

        $weeklyScopeOfWorksByWeek = collect($weeklySavedByWeek)
            ->map(function ($rows) {
                return collect($rows)
                    ->map(fn ($row) => trim((string) ($row['scope_of_work'] ?? '')))
                    ->filter(fn (string $scope) => $scope !== '')
                    ->unique(fn (string $scope) => Str::lower($scope))
                    ->values()
                    ->all();
            })
            ->filter(fn ($scopes) => !empty($scopes))
            ->all();

        return Inertia::render('Public/ProgressSubmit', [
            'submitToken' => [
                'token' => $submitToken->token,
                'project_id' => $submitToken->project_id,
                'project_name' => $submitToken->project->name,
                'foreman_name' => $submitToken->foreman->fullname,
                'expires_at' => optional($submitToken->expires_at)?->toDateTimeString(),
                'current_date' => Carbon::now('Asia/Manila')->toDateString(),
                'current_week_start' => Carbon::now('Asia/Manila')
                    ->startOfWeek(Carbon::MONDAY)
                    ->toDateString(),
                'receipt_url' => route('public.progress-receipt', ['token' => $submitToken->token]),
                'workers' => $workers,
                'weekly_scope_of_works' => $weeklyScopeOfWorks,
                'weekly_scope_of_works_by_week' => $weeklyScopeOfWorksByWeek,
                'weekly_scope_defaults_enabled' => $weeklyScopeDefaultsEnabled,
                'weekly_scope_photo_map' => $weeklyScopePhotoMap,
                'photo_categories' => ProgressPhoto::categories(),
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
        $submitToken->load(['project', 'foreman:id,fullname']);
        $project = $submitToken->project;

        $scopes = $project->scopes()
            ->with(['photos' => fn ($query) => $query->latest('id')->limit(4)])
            ->orderBy('scope_name')
            ->get();

        $assigneeNames = $scopes
            ->flatMap(fn (ProjectScope $scope) => preg_split('/[,;|]+/', (string) ($scope->assigned_personnel ?? '')))
            ->map(fn ($name) => trim((string) $name))
            ->filter(fn (string $name) => $name !== '')
            ->unique(fn (string $name) => Str::lower($name))
            ->values();

        $assigneePhotoMap = $assigneeNames->isEmpty()
            ? []
            : $this->foremanProgressRepository->users()
                ->with('detail:id,user_id,profile_photo_path')
                ->whereIn('fullname', $assigneeNames->all())
                ->get(['id', 'fullname'])
                ->mapWithKeys(function (User $user) {
                    $photoPath = optional($user->detail)->profile_photo_path;

                    return [Str::lower($user->fullname) => $photoPath ?: null];
                })
                ->all();

        $scopeRows = $scopes->map(function (ProjectScope $scope) use ($assigneePhotoMap) {
            $progress = (float) ($scope->progress_percent ?? 0);
            $weight = (float) ($scope->weight_percent ?? 0);
            $contract = (float) ($scope->contract_amount ?? 0);
            $computedPercent = round($weight * $progress / 100, 2);
            $amountToDate = round($contract * min(100, $progress) / 100, 2);

            $assignees = collect(preg_split('/[,;|]+/', (string) ($scope->assigned_personnel ?? '')))
                ->map(fn ($name) => trim((string) $name))
                ->filter(fn (string $name) => $name !== '')
                ->map(fn (string $name) => [
                    'name' => $name,
                    'photo_path' => $assigneePhotoMap[Str::lower($name)] ?? null,
                ])
                ->values()
                ->all();

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
                'assignees' => $assignees,
                'photos' => $scope->photos->map(fn ($photo) => [
                    'id' => $photo->id,
                    'photo_path' => $photo->photo_path,
                    'caption' => $photo->caption,
                    'created_at' => optional($photo->created_at)?->toDateTimeString(),
                ])->values(),
            ];
        })->values();

        $issueTotals = $this->foremanProgressRepository->issueReports()
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
            'receipt' => $this->buildReceiptPayload($submitToken),
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'client' => $project->client,
                'phase' => $project->phase,
                'status' => $project->status,
                'location' => $project->location,
            ],
            'foreman_name' => $submitToken->foreman->fullname ?? '',
            'scopes' => $scopeRows,
            'totals' => $totals,
            'issue_summary' => [
                IssueReport::STATUS_OPEN => $issueTotals[IssueReport::STATUS_OPEN] ?? 0,
                IssueReport::STATUS_RESOLVED => $issueTotals[IssueReport::STATUS_RESOLVED] ?? 0,
            ],
            'token' => $submitToken->token,
            'expires_at' => optional($submitToken->expires_at)?->toDateTimeString(),
        ]);
    }

    public function exportReceipt(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);
        $submitToken->load(['project']);
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

            $assigneeLabel = collect(preg_split('/[,;|]+/', (string) ($scope->assigned_personnel ?? '')))
                ->map(fn ($name) => trim((string) $name))
                ->filter(fn (string $name) => $name !== '')
                ->unique(fn (string $name) => Str::lower($name))
                ->implode(', ');

            return [
                'scope_name' => $scope->scope_name,
                'contract_amount' => $contract,
                'weight_percent' => $weight,
                'progress_percent' => (float) $scope->progress_percent,
                'computed_percent' => $computedPercent,
                'amount_to_date' => $amountToDate,
                'start_date' => optional($scope->start_date)?->toDateString(),
                'target_completion' => optional($scope->target_completion)?->toDateString(),
                'assignee_label' => $assigneeLabel !== '' ? $assigneeLabel : 'Unassigned',
                'photo_count' => $scope->photos->count(),
            ];
        })->values();

        $subject = 'Weight Percentage';
        $submittedDate = optional($submitToken->updated_at ?? $submitToken->created_at)?->toDateString();

        $rows = [
            ['Owner', $project->client ?? ''],
            ['Project', $project->name ?? ''],
            ['Location', $project->location ?? ''],
            ['Subject', $subject],
            ['Date', $submittedDate ?? ''],
            [],
            [
                'Scope of Works and Materials',
                'Contract Amount',
                'WT %',
                '% Accomp',
                'Amount',
                'WT %',
            ],
        ];

        foreach ($scopeRows as $row) {
            $rows[] = [
                $row['scope_name'],
                number_format($row['contract_amount'], 2, '.', ''),
                number_format($row['weight_percent'], 2, '.', ''),
                number_format($row['amount_to_date'], 2, '.', ''),
                number_format($row['progress_percent'], 0, '.', ''),
                number_format($row['computed_percent'], 2, '.', ''),
            ];
        }

        $filename = Str::slug($project->name ?: 'progress-receipt') . '-receipt.csv';

        return response()->streamDownload(function () use ($rows) {
            $handle = fopen('php://output', 'w');
            fprintf($handle, "\xEF\xBB\xBF");
            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function store(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'progress_note' => ['required', 'string', 'max:2000'],
            'photo' => UploadManager::imageRules(true),
            'caption' => ['nullable', 'string', 'max:255'],
        ]);

        $uploaded = $validated['photo'];
        $path = UploadManager::store($uploaded, 'public-progress/' . $submitToken->project_id);
        $progressNote = trim((string) $validated['progress_note']);
        $caption = trim((string) ($validated['caption'] ?? ''));

        $this->foremanProgressRepository->projectUpdates()->create([
            'project_id' => $submitToken->project_id,
            'note' => $this->formattedProgressNote($submitToken->foreman->fullname, $progressNote, $caption),
            'created_by' => $submitToken->foreman_id,
        ]);

        $this->foremanProgressRepository->projectFiles()->create([
            'project_id' => $submitToken->project_id,
            'file_path' => $path,
            'original_name' => $this->submittedPhotoName($uploaded->getClientOriginalExtension()),
            'uploaded_by' => $submitToken->foreman_id,
        ]);

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', __('messages.public_progress.progress_submitted'));
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
            'delivery_status' => ['nullable', Rule::in(DeliveryConfirmation::publicStatusOptions())],
            'delivery_item_delivered' => ['nullable', 'string', 'max:255'],
            'delivery_quantity' => ['nullable', 'string', 'max:120'],
            'delivery_supplier' => ['nullable', 'string', 'max:255'],
            'delivery_note' => ['nullable', 'string', 'max:500'],
            'delivery_photo' => UploadManager::imageRules(),

            'material_name' => ['nullable', 'string', 'max:255'],
            'material_quantity' => ['nullable', 'string', 'max:120'],
            'material_unit' => ['nullable', 'string', 'max:120'],
            'material_remarks' => ['nullable', 'string', 'max:1000'],
            'material_photo' => UploadManager::imageRules(),

            'weekly_week_start' => ['nullable', 'date'],
            'weekly_scopes' => ['nullable', 'array'],
            'weekly_scopes.*.scope_of_work' => ['nullable', 'string', 'max:255'],
            'weekly_scopes.*.percent_completed' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'weekly_scopes.*.photo_caption' => ['nullable', 'string', 'max:255'],
            'weekly_scopes.*.photos' => ['nullable', 'array'],
            'weekly_scopes.*.photos.*' => UploadManager::imageRules(),
            'weekly_removed_scopes' => ['nullable', 'array'],
            'weekly_removed_scopes.*' => ['nullable', 'string', 'max:255'],

            'photo_file' => UploadManager::imageRules(),
            'photo_category' => ['nullable', Rule::in(ProgressPhoto::categories())],
            'photo_description' => ['nullable', 'string', 'max:1000'],

            'issue_title' => ['nullable', 'string', 'max:255'],
            'issue_description' => ['nullable', 'string', 'max:2000'],
            'issue_urgency' => ['nullable', Rule::in(IssueReport::urgencyOptions())],
            'issue_photo' => UploadManager::imageRules(),
        ];

        foreach (Attendance::DAY_KEYS as $dayKey) {
            $rules["attendance_entries.*.days.{$dayKey}"] = ['nullable', Rule::in(array_keys(Attendance::STATUS_HOURS))];
        }

        $validated = $request->validate($rules);
        $submittedAny = false;

        $attendanceEntries = collect($validated['attendance_entries'] ?? [])
            ->map(function (array $entry) {
                $workerName = trim((string) ($entry['worker_name'] ?? ''));
                $workerRole = trim((string) ($entry['worker_role'] ?? ''));
                $days = [];
                foreach (Attendance::DAY_KEYS as $dayKey) {
                    $days[$dayKey] = strtoupper(trim((string) (($entry['days'][$dayKey] ?? ''))));
                }

                return [
                    'worker_name' => $workerName,
                    'worker_role' => $workerRole !== '' ? $workerRole : 'Worker',
                    'days' => $days,
                ];
            })
            ->filter(fn (array $row) => !$this->isForemanRole($row['worker_role']))
            ->filter(fn (array $row) => $row['worker_name'] !== '' && collect($row['days'])->contains(fn ($status) => $status !== ''))
            ->values();

        if ($attendanceEntries->isNotEmpty()) {
            $attendanceWeekStart = trim((string) ($validated['attendance_week_start'] ?? ''));
            if ($attendanceWeekStart === '') {
                throw ValidationException::withMessages([
                    'attendance_week_start' => __('messages.public_progress.attendance_week_start_required'),
                ]);
            }

            $selectedWeekStart = Carbon::parse($attendanceWeekStart)
                ->startOfWeek(Carbon::MONDAY)
                ->toDateString();
            $currentWeekStart = Carbon::now('Asia/Manila')
                ->startOfWeek(Carbon::MONDAY)
                ->toDateString();

            if ($selectedWeekStart !== $currentWeekStart) {
                throw ValidationException::withMessages([
                    'attendance_week_start' => __('messages.public_progress.attendance_current_week_only'),
                ]);
            }

            $this->syncWorkersFromAttendanceEntries($submitToken, $attendanceEntries);

            $weekStart = Carbon::parse($selectedWeekStart, 'Asia/Manila');

            foreach ($attendanceEntries as $entry) {
                foreach (Attendance::DAY_KEYS as $dayKey) {
                    $status = $entry['days'][$dayKey] ?? '';
                    if ($status === '') {
                        continue;
                    }

                    $date = $weekStart->copy()->addDays(Attendance::DAY_OFFSETS[$dayKey])->toDateString();
                    $hours = (float) (Attendance::STATUS_HOURS[$status] ?? 0);

                    $this->foremanProgressRepository->attendances()->updateOrCreate(
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

        // Ignore default form values (date/status). Only create delivery rows when
        // the user actually enters delivery details or uploads a delivery photo.
        $deliveryTouched = $this->hasAnyText([
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
                    'delivery_date' => __('messages.public_progress.delivery_required_fields'),
                ]);
            }

            $status = $deliveryStatus === DeliveryConfirmation::PUBLIC_STATUS_COMPLETE
                ? DeliveryConfirmation::STATUS_RECEIVED
                : DeliveryConfirmation::STATUS_INCOMPLETE;
            $itemDelivered = trim((string) ($validated['delivery_item_delivered'] ?? ''));
            $quantity = trim((string) ($validated['delivery_quantity'] ?? ''));
            $deliveryPhotoPath = null;
            $note = trim((string) ($validated['delivery_note'] ?? ''));

            if (isset($validated['delivery_photo'])) {
                $deliveryPhotoPath = UploadManager::store(
                    $validated['delivery_photo'],
                    'progress-photos/public-token/' . $submitToken->project_id
                );
            }

            $this->foremanProgressRepository->deliveries()->create([
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
                $caption = '[Delivery] ' . ($status === DeliveryConfirmation::STATUS_RECEIVED ? 'Complete' : 'Incomplete');
                if ($note !== '') {
                    $caption .= ' - ' . $note;
                }

                $this->foremanProgressRepository->progressPhotos()->create([
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
                    'material_name' => __('messages.public_progress.material_required_fields'),
                ]);
            }

            $materialPhotoPath = null;
            if (isset($validated['material_photo'])) {
                $materialPhotoPath = UploadManager::store(
                    $validated['material_photo'],
                    'progress-photos/public-token/' . $submitToken->project_id
                );
            }

            $this->foremanProgressRepository->materialRequests()->create([
                'project_id' => $submitToken->project_id,
                'foreman_id' => $submitToken->foreman_id,
                'material_name' => $materialName,
                'quantity' => $materialQuantity,
                'unit' => $materialUnit,
                'remarks' => trim((string) ($validated['material_remarks'] ?? '')) ?: null,
                'status' => MaterialRequest::STATUS_PENDING,
                'photo_path' => $materialPhotoPath,
            ]);

            if ($materialPhotoPath !== null) {
                $caption = '[Material] ' . $materialName;
                $remarks = trim((string) ($validated['material_remarks'] ?? ''));
                if ($remarks !== '') {
                    $caption .= ' - ' . $remarks;
                }

                $this->foremanProgressRepository->progressPhotos()->create([
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
                $percent = $this->normalizePercentCompleted($scope['percent_completed'] ?? null);

                return [
                    'scope_of_work' => trim((string) ($scope['scope_of_work'] ?? '')),
                    'percent_completed' => $percent,
                    'photo_caption' => trim((string) ($scope['photo_caption'] ?? '')),
                    'photos' => collect($scope['photos'] ?? [])
                        ->filter(fn ($photo) => $photo instanceof UploadedFile)
                        ->values()
                        ->all(),
                ];
            })
            ->filter(fn (array $scope) => $scope['scope_of_work'] !== '')
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
                    'weekly_week_start' => __('messages.public_progress.weekly_week_start_required'),
                ]);
            }

            $weekStart = Carbon::parse($weeklyWeekStart)->startOfWeek(Carbon::MONDAY)->toDateString();
            $normalizedForemanName = Str::lower(trim((string) ($submitToken->foreman->fullname ?? '')));
            $assignedScopeKeys = $this->foremanProgressRepository->projectScopes()
                ->where('project_id', $submitToken->project_id)
                ->get(['scope_name', 'assigned_personnel'])
                ->filter(function (ProjectScope $scopeRow) use ($normalizedForemanName) {
                    $assignedPersonnel = collect(preg_split('/[,;]+/', (string) ($scopeRow->assigned_personnel ?? '')))
                        ->map(fn ($name) => trim((string) $name))
                        ->filter(fn (string $name) => $name !== '')
                        ->map(fn (string $name) => Str::lower($name))
                        ->values();

                    if ($assignedPersonnel->isEmpty()) {
                        return false;
                    }

                    if ($normalizedForemanName === '') {
                        return false;
                    }

                    return $assignedPersonnel->contains($normalizedForemanName);
                })
                ->mapWithKeys(function (ProjectScope $scopeRow) {
                    $scopeName = trim((string) ($scopeRow->scope_name ?? ''));
                    if ($scopeName === '') {
                        return [];
                    }

                    return [Str::lower($scopeName) => true];
                })
                ->all();
            $allowedWeeklyScopes = $weeklyScopes
                ->filter(fn (array $scope) => isset($assignedScopeKeys[Str::lower($scope['scope_of_work'])]))
                ->values();
            $allowedWeeklyScopePhotos = $weeklyScopePhotos
                ->filter(fn (array $scope) => isset($assignedScopeKeys[Str::lower($scope['scope_of_work'])]))
                ->values();
            $weeklyScopes = $allowedWeeklyScopes;
            $weeklyScopePhotos = $allowedWeeklyScopePhotos;
            $submittedScopeKeys = $weeklyScopes
                ->pluck('scope_of_work')
                ->map(fn (string $scope) => Str::lower($scope))
                ->values();
            $scopesToDelete = $weeklyRemovedScopes
                ->filter(fn (string $scope) => !$submittedScopeKeys->contains(Str::lower($scope)))
                ->values();

            if ($scopesToDelete->isNotEmpty()) {
                $this->foremanProgressRepository->weeklyAccomplishments()
                    ->where('foreman_id', $submitToken->foreman_id)
                    ->where('project_id', $submitToken->project_id)
                    ->whereDate('week_start', $weekStart)
                    ->whereIn('scope_of_work', $scopesToDelete->all())
                    ->delete();
            }

            foreach ($weeklyScopes as $scope) {
                $this->foremanProgressRepository->weeklyAccomplishments()->updateOrCreate(
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
                    'photo_file' => __('messages.public_progress.photo_required'),
                ]);
            }

            $path = UploadManager::store(
                $validated['photo_file'],
                'progress-photos/public-token/' . $submitToken->project_id
            );
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

            $this->foremanProgressRepository->progressPhotos()->create([
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
            $issueUrgency = trim((string) ($validated['issue_urgency'] ?? IssueReport::URGENCY_NORMAL));

            if ($issueTitle === '' || $issueDescription === '') {
                throw ValidationException::withMessages([
                    'issue_title' => __('messages.public_progress.issue_required_fields'),
                ]);
            }

            $severity = IssueReport::urgencyToSeverity($issueUrgency);
            $issuePhotoPath = null;
            if (isset($validated['issue_photo'])) {
                $issuePhotoPath = UploadManager::store(
                    $validated['issue_photo'],
                    'progress-photos/public-token/' . $submitToken->project_id
                );
            }

            $this->foremanProgressRepository->issueReports()->create([
                'project_id' => $submitToken->project_id,
                'foreman_id' => $submitToken->foreman_id,
                'issue_title' => $issueTitle,
                'description' => $issueDescription,
                'severity' => $severity,
                'status' => IssueReport::STATUS_OPEN,
                'photo_path' => $issuePhotoPath,
            ]);

            if ($issuePhotoPath !== null) {
                $this->foremanProgressRepository->progressPhotos()->create([
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
                'submit_all' => __('messages.public_progress.submit_any_required'),
            ]);
        }

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', __('messages.public_progress.jotform_submitted'));
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

        foreach (Attendance::DAY_KEYS as $dayKey) {
            $rules["entries.*.days.{$dayKey}"] = ['nullable', Rule::in(array_keys(Attendance::STATUS_HOURS))];
        }

        $validated = $request->validate($rules);
        $weekStart = Carbon::parse($validated['week_start'])->startOfWeek(Carbon::MONDAY);
        $entries = collect($validated['entries'])
            ->filter(fn ($entry) => !$this->isForemanRole($entry['worker_role'] ?? ''));
        $this->syncWorkersFromAttendanceEntries($submitToken, $entries);

        foreach ($entries as $entry) {
            $workerName = trim((string) $entry['worker_name']);
            if ($workerName === '') {
                continue;
            }

            $workerRole = trim((string) ($entry['worker_role'] ?? 'Worker'));
            if ($this->isForemanRole($workerRole)) {
                continue;
            }
            foreach (Attendance::DAY_KEYS as $dayKey) {
                $status = strtoupper(trim((string) ($entry['days'][$dayKey] ?? '')));
                if ($status === '') {
                    continue;
                }

                $date = $weekStart->copy()->addDays(Attendance::DAY_OFFSETS[$dayKey])->toDateString();
                $hours = (float) (Attendance::STATUS_HOURS[$status] ?? 0);

                $this->foremanProgressRepository->attendances()->updateOrCreate(
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
            ->with('success', __('messages.public_progress.attendance_submitted'));
    }

    public function storeDelivery(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'delivery_date' => ['required', 'date'],
            'status' => ['required', Rule::in(DeliveryConfirmation::publicStatusOptions())],
            'item_delivered' => ['nullable', 'string', 'max:255'],
            'quantity' => ['nullable', 'string', 'max:120'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'photo' => UploadManager::imageRules(),
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $status = $validated['status'] === DeliveryConfirmation::PUBLIC_STATUS_COMPLETE
            ? DeliveryConfirmation::STATUS_RECEIVED
            : DeliveryConfirmation::STATUS_INCOMPLETE;
        $itemDelivered = trim((string) ($validated['item_delivered'] ?? ''));
        $quantity = trim((string) ($validated['quantity'] ?? ''));
        $deliveryPhotoPath = null;
        $note = trim((string) ($validated['note'] ?? ''));

        if (isset($validated['photo'])) {
            $deliveryPhotoPath = UploadManager::store(
                $validated['photo'],
                'progress-photos/public-token/' . $submitToken->project_id
            );
        }

        $this->foremanProgressRepository->deliveries()->create([
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
            $caption = '[Delivery] ' . ($status === DeliveryConfirmation::STATUS_RECEIVED ? 'Complete' : 'Incomplete');
            if ($note !== '') {
                $caption .= ' - ' . $note;
            }

            $this->foremanProgressRepository->progressPhotos()->create([
                'foreman_id' => $submitToken->foreman_id,
                'project_id' => $submitToken->project_id,
                'photo_path' => $deliveryPhotoPath,
                'caption' => $caption,
            ]);
        }

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', __('messages.public_progress.delivery_submitted'));
    }

    public function deleteDelivery(Request $request, string $token, DeliveryConfirmation $deliveryConfirmation)
    {
        $submitToken = $this->resolveActiveToken($token);

        if ((int) $deliveryConfirmation->project_id !== (int) $submitToken->project_id
            || (int) $deliveryConfirmation->foreman_id !== (int) $submitToken->foreman_id) {
            abort(403);
        }

        $photoPath = $deliveryConfirmation->photo_path;
        $deliveryConfirmation->delete();

        if ($photoPath) {
            $this->foremanProgressRepository->progressPhotos()
                ->where('foreman_id', $submitToken->foreman_id)
                ->where('project_id', $submitToken->project_id)
                ->where('photo_path', $photoPath)
                ->where('caption', 'like', '[Delivery]%')
                ->delete();

            $this->deleteUploadedPath($photoPath);
        }

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token]);
    }

    public function storeMaterialRequest(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'material_name' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'string', 'max:120'],
            'unit' => ['required', 'string', 'max:120'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'photo' => UploadManager::imageRules(),
        ]);

        $materialPhotoPath = null;
        if (isset($validated['photo'])) {
            $materialPhotoPath = UploadManager::store(
                $validated['photo'],
                'progress-photos/public-token/' . $submitToken->project_id
            );
        }

        $this->foremanProgressRepository->materialRequests()->create([
            'project_id' => $submitToken->project_id,
            'foreman_id' => $submitToken->foreman_id,
            'material_name' => trim((string) $validated['material_name']),
            'quantity' => trim((string) $validated['quantity']),
            'unit' => trim((string) $validated['unit']),
            'remarks' => trim((string) ($validated['remarks'] ?? '')) ?: null,
            'status' => MaterialRequest::STATUS_PENDING,
            'photo_path' => $materialPhotoPath,
        ]);

        if ($materialPhotoPath !== null) {
            $caption = '[Material] ' . trim((string) $validated['material_name']);
            $remarks = trim((string) ($validated['remarks'] ?? ''));
            if ($remarks !== '') {
                $caption .= ' - ' . $remarks;
            }

            $this->foremanProgressRepository->progressPhotos()->create([
                'foreman_id' => $submitToken->foreman_id,
                'project_id' => $submitToken->project_id,
                'photo_path' => $materialPhotoPath,
                'caption' => $caption,
            ]);
        }

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', __('messages.public_progress.material_submitted'));
    }

    public function deleteMaterialRequest(Request $request, string $token, MaterialRequest $materialRequest)
    {
        $submitToken = $this->resolveActiveToken($token);

        if ((int) $materialRequest->project_id !== (int) $submitToken->project_id
            || (int) $materialRequest->foreman_id !== (int) $submitToken->foreman_id) {
            abort(403);
        }

        $photoPath = $materialRequest->photo_path;
        $materialRequest->delete();

        if ($photoPath) {
            $this->foremanProgressRepository->progressPhotos()
                ->where('foreman_id', $submitToken->foreman_id)
                ->where('project_id', $submitToken->project_id)
                ->where('photo_path', $photoPath)
                ->where('caption', 'like', '[Material]%')
                ->delete();

            $this->deleteUploadedPath($photoPath);
        }

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token]);
    }

    public function storeWeeklyProgress(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'week_start' => ['required', 'date'],
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*.scope_of_work' => ['required', 'string', 'max:255'],
            'scopes.*.percent_completed' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'scopes.*.photo_caption' => ['nullable', 'string', 'max:255'],
            'scopes.*.photos' => ['nullable', 'array'],
            'scopes.*.photos.*' => UploadManager::imageRules(),
        ]);

        $weekStart = Carbon::parse($validated['week_start'])
            ->startOfWeek(Carbon::MONDAY)
            ->toDateString();

        foreach ($validated['scopes'] as $scope) {
            $scopeName = trim((string) ($scope['scope_of_work'] ?? ''));
            if ($scopeName === '') {
                continue;
            }

            $this->foremanProgressRepository->weeklyAccomplishments()->updateOrCreate(
                [
                    'foreman_id' => $submitToken->foreman_id,
                    'project_id' => $submitToken->project_id,
                    'week_start' => $weekStart,
                    'scope_of_work' => $scopeName,
                ],
                [
                    'percent_completed' => $this->normalizePercentCompleted($scope['percent_completed'] ?? null),
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
            ->with('success', __('messages.public_progress.weekly_submitted'));
    }

    public function storePhoto(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'photo' => UploadManager::imageRules(true),
            'category' => ['nullable', Rule::in(ProgressPhoto::categories())],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $path = UploadManager::store($validated['photo'], 'progress-photos/public-token/' . $submitToken->project_id);
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

        $this->foremanProgressRepository->progressPhotos()->create([
            'foreman_id' => $submitToken->foreman_id,
            'project_id' => $submitToken->project_id,
            'photo_path' => $path,
            'caption' => $caption,
        ]);

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', __('messages.public_progress.photo_uploaded'));
    }

    public function deletePhoto(Request $request, string $token, ProgressPhoto $progressPhoto)
    {
        $submitToken = $this->resolveActiveToken($token);

        if ((int) $progressPhoto->project_id !== (int) $submitToken->project_id
            || (int) $progressPhoto->foreman_id !== (int) $submitToken->foreman_id) {
            abort(403);
        }

        $caption = trim((string) ($progressPhoto->caption ?? ''));
        if (Str::startsWith($caption, ['[Material]', '[Delivery]', '[Issue]'])) {
            abort(403);
        }

        $photoPath = $progressPhoto->photo_path;
        $progressPhoto->delete();
        $this->deleteUploadedPath($photoPath);

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token]);
    }

    public function storeIssueReport(Request $request, string $token)
    {
        $submitToken = $this->resolveActiveToken($token);

        $validated = $request->validate([
            'issue_title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:2000'],
            'urgency' => ['required', Rule::in(IssueReport::urgencyOptions())],
            'photo' => UploadManager::imageRules(),
        ]);

        $severity = IssueReport::urgencyToSeverity((string) $validated['urgency']);

        $issuePhotoPath = null;
        if (isset($validated['photo'])) {
            $issuePhotoPath = UploadManager::store(
                $validated['photo'],
                'progress-photos/public-token/' . $submitToken->project_id
            );
        }

        $this->foremanProgressRepository->issueReports()->create([
            'project_id' => $submitToken->project_id,
            'foreman_id' => $submitToken->foreman_id,
            'issue_title' => trim((string) $validated['issue_title']),
            'description' => trim((string) $validated['description']),
            'severity' => $severity,
            'status' => IssueReport::STATUS_OPEN,
            'photo_path' => $issuePhotoPath,
        ]);

        if ($issuePhotoPath !== null) {
            $this->foremanProgressRepository->progressPhotos()->create([
                'foreman_id' => $submitToken->foreman_id,
                'project_id' => $submitToken->project_id,
                'photo_path' => $issuePhotoPath,
                'caption' => '[Issue] ' . trim((string) $validated['issue_title']),
            ]);
        }

        $submitToken->markSubmitted();

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token])
            ->with('success', __('messages.public_progress.issue_submitted'));
    }

    public function deleteIssueReport(Request $request, string $token, IssueReport $issueReport)
    {
        $submitToken = $this->resolveActiveToken($token);

        if ((int) $issueReport->project_id !== (int) $submitToken->project_id
            || (int) $issueReport->foreman_id !== (int) $submitToken->foreman_id) {
            abort(403);
        }

        $photoPath = $issueReport->photo_path;
        $issueReport->delete();

        if ($photoPath) {
            $this->foremanProgressRepository->progressPhotos()
                ->where('foreman_id', $submitToken->foreman_id)
                ->where('project_id', $submitToken->project_id)
                ->where('photo_path', $photoPath)
                ->where('caption', 'like', '[Issue]%')
                ->delete();

            $this->deleteUploadedPath($photoPath);
        }

        return redirect()
            ->route('public.progress-submit.show', ['token' => $token]);
    }

    private function resolveActiveToken(string $token): ProgressSubmitToken
    {
        $submitToken = $this->foremanProgressRepository->progressSubmitTokens()
            ->with(['project', 'foreman:id,fullname'])
            ->where('token', $token)
            ->firstOrFail();

        abort_unless($submitToken->isActive(), 404);

        return $submitToken;
    }

    private function deleteUploadedPath(?string $path): void
    {
        $normalizedPath = trim((string) $path);
        if ($normalizedPath === '') {
            return;
        }

        UploadManager::delete($normalizedPath);
    }

    private function buildReceiptPayload(ProgressSubmitToken $submitToken): array
    {
        $project = $submitToken->project;
        $scopes = $this->foremanProgressRepository->projectScopes()
            ->where('project_id', $submitToken->project_id)
            ->with(['photos' => fn ($query) => $query->latest('id')])
            ->orderBy('id')
            ->get();

        $assigneeNames = $scopes
            ->flatMap(fn (ProjectScope $scope) => preg_split('/[,;|]+/', (string) ($scope->assigned_personnel ?? '')))
            ->map(fn ($name) => trim((string) $name))
            ->filter(fn (string $name) => $name !== '')
            ->unique(fn (string $name) => Str::lower($name))
            ->values();

        $assigneePhotoMap = $assigneeNames->isEmpty()
            ? []
            : $this->foremanProgressRepository->users()
                ->with('detail:id,user_id,profile_photo_path')
                ->whereIn('fullname', $assigneeNames->all())
                ->get(['id', 'fullname'])
                ->mapWithKeys(function (User $user) {
                    $photoPath = optional($user->detail)->profile_photo_path;

                    return [Str::lower($user->fullname) => $photoPath ?: null];
                })
                ->all();

        $weights = $this->receiptWeightDistribution($scopes->count());
        $contractAmount = (float) ($project?->contract_amount ?? 0);
        $rows = [];
        $totalWeightPercent = 0.0;
        $weightedProgressPercent = 0.0;
        $computedAmount = 0.0;

        foreach ($scopes->values() as $index => $scope) {
            $weightPercent = (float) ($weights[$index] ?? 0);
            $progressPercent = (float) ($scope->progress_percent ?? 0);
            $scopeContractAmount = round(($contractAmount * $weightPercent) / 100, 2);
            $computedPercent = round(($weightPercent * $progressPercent) / 100, 2);
            $scopeComputedAmount = round(($contractAmount * $computedPercent) / 100, 2);

            $totalWeightPercent += $weightPercent;
            $weightedProgressPercent += $computedPercent;
            $computedAmount += $scopeComputedAmount;

            $rows[] = [
                'id' => $scope->id,
                'scope_name' => $scope->scope_name,
                'contract_amount' => $scopeContractAmount,
                'weight_percent' => $weightPercent,
                'progress_percent' => $progressPercent,
                'computed_percent' => $computedPercent,
                'computed_amount' => $scopeComputedAmount,
                'start_date' => optional($scope->created_at)?->toDateString(),
                'target_date' => optional($project?->target)?->toDateString(),
                'status' => $scope->status,
                'assignee' => $scope->assigned_personnel,
                'assignees' => collect(preg_split('/[,;|]+/', (string) ($scope->assigned_personnel ?? '')))
                    ->map(fn ($name) => trim((string) $name))
                    ->filter(fn (string $name) => $name !== '')
                    ->map(fn (string $name) => [
                        'name' => $name,
                        'photo_path' => $assigneePhotoMap[Str::lower($name)] ?? null,
                    ])
                    ->values()
                    ->all(),
                'remarks' => $scope->remarks,
                'photos' => $scope->photos
                    ->take(4)
                    ->map(fn ($photo) => [
                        'id' => $photo->id,
                        'photo_path' => $photo->photo_path,
                        'caption' => $photo->caption,
                    ])
                    ->values()
                    ->all(),
                'issues' => [
                    IssueReport::STATUS_OPEN => 0,
                    IssueReport::STATUS_RESOLVED => 0,
                ],
            ];
        }

        return [
            'token' => $submitToken->token,
            'project_name' => $project?->name,
            'project_client' => $project?->client,
            'project_phase' => $project?->phase,
            'project_status' => $project?->status,
            'project_target' => optional($project?->target)?->toDateString(),
            'foreman_name' => $submitToken->foreman?->fullname,
            'access_link' => route('public.progress-submit.show', ['token' => $submitToken->token]),
            'expires_at' => optional($submitToken->expires_at)?->toDateTimeString(),
            'submitted_at' => optional($submitToken->last_submitted_at)?->toDateTimeString(),
            'submission_count' => (int) ($submitToken->submission_count ?? 0),
            'total_contract_amount' => round($contractAmount, 2),
            'total_weight_percent' => round($totalWeightPercent, 2),
            'weighted_progress_percent' => round($weightedProgressPercent, 2),
            'computed_amount' => round($computedAmount, 2),
            'scopes' => $rows,
        ];
    }

    private function receiptWeightDistribution(int $count): array
    {
        if ($count <= 0) {
            return [];
        }

        $weights = [];
        $remaining = 100.0;

        for ($index = 0; $index < $count; $index++) {
            if ($index === $count - 1) {
                $weights[] = round($remaining, 2);
                continue;
            }

            $slotsLeft = $count - $index;
            $weight = round($remaining / $slotsLeft, 2);
            $weights[] = $weight;
            $remaining = round($remaining - $weight, 2);
        }

        return $weights;
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

    private function normalizePercentCompleted(mixed $value): float
    {
        $raw = trim((string) ($value ?? ''));
        if ($raw === '') {
            return 0.0;
        }

        if (!is_numeric($raw)) {
            return 0.0;
        }

        $numeric = (float) $raw;

        return max(0.0, min(100.0, $numeric));
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
            return Attendance::CODE_PRESENT;
        }

        if ($hours >= 3.5) {
            return Attendance::CODE_HALF_DAY;
        }

        return Attendance::CODE_ABSENT;
    }

    private function isForemanRole(?string $role): bool
    {
        return Str::lower(trim((string) $role)) === Str::lower(Attendance::ROLE_FOREMAN);
    }

    private function syncWorkersFromAttendanceEntries(ProgressSubmitToken $submitToken, iterable $attendanceEntries): void
    {
        $normalizedNames = collect($attendanceEntries)
            ->filter(fn ($entry) => !$this->isForemanRole($entry['worker_role'] ?? ''))
            ->map(fn ($entry) => trim((string) (($entry['worker_name'] ?? ''))))
            ->filter(fn (string $name) => $name !== '')
            ->unique(fn (string $name) => Str::lower($name))
            ->values();

        foreach ($normalizedNames as $workerName) {
            $worker = $this->foremanProgressRepository->workers()
                ->where('foreman_id', $submitToken->foreman_id)
                ->whereRaw('LOWER(name) = ?', [Str::lower($workerName)])
                ->first();

            if (!$worker) {
                $this->foremanProgressRepository->workers()->create([
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
        $projectScopeRows = $this->foremanProgressRepository->projectScopes()
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
                $projectScope = $this->foremanProgressRepository->projectScopes()->create([
                    'project_id' => $projectId,
                    'scope_name' => $scopeName,
                    'assigned_personnel' => $assignee !== '' ? $assignee : null,
                    'progress_percent' => 0,
                    'status' => ProjectScope::STATUS_NOT_STARTED,
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
                $path = UploadManager::store($photo, 'scope-photos/' . $projectScope->id);

                $this->foremanProgressRepository->scopePhotos()->create([
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

    private function extractWeekStartFromScopePhoto(?string $caption): ?string
    {
        $text = trim((string) ($caption ?? ''));
        if ($text === '') {
            return null;
        }

        if (preg_match('/Week:\\s*(\\d{4}-\\d{2}-\\d{2})/i', $text, $matches) === 1) {
            return $matches[1];
        }

        return null;
    }

    private function syncProjectOverallProgressFromWeekly(int $projectId): void
    {
        if ($projectId <= 0) {
            return;
        }

        $project = $this->foremanProgressRepository->projects()->find($projectId);
        if (!$project) {
            return;
        }

        $latestWeekStart = $this->foremanProgressRepository->weeklyAccomplishments()
            ->where('project_id', $projectId)
            ->max('week_start');

        $progressPercent = null;

        if ($latestWeekStart) {
            $progressPercent = (float) ($this->foremanProgressRepository->weeklyAccomplishments()
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
            $existingScope = $this->foremanProgressRepository->projectScopes()
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

            $this->foremanProgressRepository->projectScopes()->create([
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
            return ProjectScope::STATUS_COMPLETED;
        }

        if ($progress <= 0) {
            return ProjectScope::STATUS_NOT_STARTED;
        }

        return ProjectScope::STATUS_IN_PROGRESS;
    }
}



