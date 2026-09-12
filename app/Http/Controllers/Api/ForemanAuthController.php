<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Controllers\ProcessedRecordController;
use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProcessedRecord;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\UserDetail;
use App\Models\WeeklyAccomplishment;
use App\Models\Worker;
use App\Services\ForemanApiTokenService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class ForemanAuthController extends Controller
{
    private const LOGIN_MAX_ATTEMPTS = 5;
    private const LOGIN_DECAY_SECONDS = 60;

    public function __construct(
        private readonly ForemanApiTokenService $tokens
    ) {
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $throttleKey = 'foreman_api_login|'.Str::lower($credentials['email']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, self::LOGIN_MAX_ATTEMPTS)) {
            return response()->json([
                'message' => 'Too many login attempts. Please try again in '.RateLimiter::availableIn($throttleKey).' seconds.',
            ], 429);
        }

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            RateLimiter::hit($throttleKey, self::LOGIN_DECAY_SECONDS);

            return response()->json(['message' => 'Invalid email or password.'], 422);
        }

        if ($user->role !== User::ROLE_FOREMAN) {
            RateLimiter::hit($throttleKey, self::LOGIN_DECAY_SECONDS);

            return response()->json(['message' => 'This account is not a foreman account.'], 403);
        }

        RateLimiter::clear($throttleKey);

        $expiresAt = $this->tokens->expiresAt();

        return response()->json([
            'token' => $this->tokens->issue($user),
            'token_type' => 'Bearer',
            'expires_in_minutes' => ForemanApiTokenService::TOKEN_TTL_MINUTES,
            'expires_at' => $expiresAt->toIso8601String(),
            'server_time' => now()->toIso8601String(),
            'user' => $this->userPayload($user),
            'projects' => $this->assignedProjects($user),
        ]);
    }

    public function serverTime()
    {
        return response()->json([
            'server_time' => now()->toIso8601String(),
            'timestamp' => now()->timestamp,
            'timezone' => config('app.timezone'),
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => $this->userPayload($user),
            'projects' => $this->assignedProjects($user),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function projects(Request $request)
    {
        return response()->json([
            'projects' => $this->assignedProjects($request->user()),
        ]);
    }

    public function stats(Request $request)
    {
        $user = $request->user();
        $assignedIds = $this->assignedProjectIds($user);

        $scoped = fn ($model) => $model::query()
            ->where('foreman_id', $user->id)
            ->when(!empty($assignedIds), fn ($query) => $query->whereIn('project_id', $assignedIds));

        return response()->json([
            'assigned_projects' => count($assignedIds),
            'attendance_logs' => $scoped(Attendance::class)->count(),
            'pending_materials' => $scoped(MaterialRequest::class)
                ->where('status', MaterialRequest::STATUS_PENDING)
                ->count(),
            'open_issues' => $scoped(IssueReport::class)
                ->where('status', IssueReport::STATUS_OPEN)
                ->count(),
            'deliveries' => $scoped(DeliveryConfirmation::class)->count(),
        ]);
    }

    public function logout()
    {
        // Stateless encrypted tokens are discarded client-side.
        return response()->json(['message' => 'Logged out.']);
    }

    public function settings(Request $request, SettingsService $settings)
    {
        return response()->json([
            'account' => $this->accountWithPhotoUrl(
                $settings->getSettingsPayload($request->user())
            ),
            'sex_options' => UserDetail::sexOptions(),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function updateSettings(UpdateSettingsRequest $request, SettingsService $settings)
    {
        $settings->updateSettings($request->user(), $request->validated());

        return response()->json([
            'message' => 'Settings updated.',
            'account' => $this->accountWithPhotoUrl(
                $settings->getSettingsPayload($request->user()->fresh())
            ),
        ]);
    }

    public function updatePhoto(Request $request, SettingsService $settings)
    {
        $validated = $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,gif,webp', 'max:10240'],
        ]);

        $user = $request->user()->load('detail');
        $path = $settings->updateProfilePhoto($user, $validated['photo']);

        return response()->json([
            'message' => 'Profile photo updated.',
            'profile_photo_path' => $path,
            'profile_photo_url' => $this->profilePhotoUrl($path),
            'account' => $this->accountWithPhotoUrl(
                $settings->getSettingsPayload($user->fresh())
            ),
        ]);
    }

    /**
     * AI attendance scan — same flow as the web jotform's AI Scan Attendance:
     * upload sheet images, AI extracts records, foreman confirms per record.
     */
    public function scanAiAttendance(Request $request, Project $project)
    {
        if (!$this->isProjectAssignedTo($request->user(), $project)) {
            return response()->json(['message' => 'Project not assigned to this foreman.'], 403);
        }

        $request->merge(['mode' => 'attendance']);

        return app(ProcessedRecordController::class)->store($request, $project);
    }

    public function confirmAiRecord(Request $request, ProcessedRecord $record)
    {
        if ((int) $record->user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Record not found.'], 404);
        }

        return app(ProcessedRecordController::class)->confirm($request, $record);
    }

    public function rejectAiRecord(Request $request, ProcessedRecord $record)
    {
        if ((int) $record->user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Record not found.'], 404);
        }

        return app(ProcessedRecordController::class)->reject($record);
    }

    public function jotform(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$this->isProjectAssignedTo($user, $project)) {
            return response()->json(['message' => 'Project not assigned to this foreman.'], 403);
        }

        $weekStart = Carbon::now(Attendance::PH_TIMEZONE)->startOfWeek(Carbon::MONDAY);

        $foremanName = trim((string) ($user->fullname ?? ''));
        $normalizedForemanName = Str::lower($foremanName);

        $workers = Worker::query()
            ->where('foreman_id', $user->id)
            ->where(function ($query) use ($project) {
                $query->whereNull('project_id')->orWhere('project_id', $project->id);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'job_type'])
            ->map(fn (Worker $worker) => [
                'id' => $worker->id,
                'name' => $worker->name,
                'role' => trim((string) ($worker->job_type ?: Worker::JOB_TYPE_WORKER)) ?: Worker::JOB_TYPE_WORKER,
            ])
            ->values();

        $projectScopeRows = ProjectScope::query()
            ->where('project_id', $project->id)
            ->orderBy('sort_order')
            ->orderBy('scope_name')
            ->get(['id', 'scope_name', 'progress_percent', 'status', 'assigned_personnel']);

        $scopeAssignedToForeman = function (ProjectScope $scope) use ($normalizedForemanName) {
            $personnel = collect(preg_split('/[,;]+/', (string) ($scope->assigned_personnel ?? '')))
                ->map(fn ($name) => trim((string) $name))
                ->filter(fn (string $name) => $name !== '')
                ->map(fn (string $name) => Str::lower($name))
                ->values();

            if ($personnel->isEmpty() || $normalizedForemanName === '') {
                return false;
            }

            return $personnel->contains($normalizedForemanName);
        };

        // Same rule as the web jotform: a foreman with at least one assigned
        // scope sees every project scope (others read-only) so unedited
        // scopes never disappear from the grid.
        $mapScope = fn (ProjectScope $scope) => [
            'id' => $scope->id,
            'scope_name' => $scope->scope_name,
            'progress_percent' => (int) ($scope->progress_percent ?? 0),
            'status' => $scope->status,
        ];

        $allScopes = $projectScopeRows->map($mapScope)->values();

        $assignedScopeNames = $projectScopeRows
            ->filter($scopeAssignedToForeman)
            ->map(fn (ProjectScope $scope) => trim((string) ($scope->scope_name ?? '')))
            ->filter(fn (string $name) => $name !== '')
            ->unique(fn (string $name) => Str::lower($name))
            ->values()
            ->all();

        $scopes = $assignedScopeNames !== [] ? $allScopes : collect();

        // Same as the web jotform: when the project has no scopes at all,
        // the default scope list applies; otherwise an unassigned foreman
        // sees no scopes.
        $weeklyScopeDefaultsEnabled = $projectScopeRows->isEmpty();

        $attendanceCurrentWeek = $this->attendanceWeekPayload($user->id, $project->id, $weekStart);

        $weeklySavedByWeek = $this->weeklySavedByWeek($user->id, $project->id);

        $weeklyCurrentWeek = WeeklyAccomplishment::query()
            ->where('foreman_id', $user->id)
            ->where('project_id', $project->id)
            ->whereDate('week_start', $weekStart->toDateString())
            ->orderBy('scope_of_work')
            ->get(['scope_of_work', 'percent_completed'])
            ->map(fn (WeeklyAccomplishment $entry) => [
                'scope_of_work' => $entry->scope_of_work,
                'percent_completed' => round((float) ($entry->percent_completed ?? 0), 1),
            ])
            ->values();

        return response()->json([
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'location' => $project->client,
                'status' => $project->status,
                'phase' => $project->phase,
            ],
            'current_date' => Carbon::now(Attendance::PH_TIMEZONE)->toDateString(),
            'current_week_start' => $weekStart->toDateString(),
            'foreman_name' => $foremanName,
            'workers' => $workers,
            'scopes' => $scopes,
            'assigned_scope_names' => $assignedScopeNames,
            'weekly_scope_defaults_enabled' => $weeklyScopeDefaultsEnabled,
            'weekly_fallback_scopes' => $weeklyScopeDefaultsEnabled
                ? WeeklyAccomplishment::defaultScopeOfWorks()
                : [],
            'attendance_current_week' => $attendanceCurrentWeek,
            'attendance_saved_by_week' => $this->attendanceSavedByWeek($user->id, $project->id),
            'weekly_current_week' => $weeklyCurrentWeek,
            'weekly_saved_by_week' => $weeklySavedByWeek,
            'recent_deliveries' => $this->recentDeliveries($user->id, $project->id),
            'recent_material_requests' => $this->recentMaterialRequests($user->id, $project->id),
            'recent_issue_reports' => $this->recentIssueReports($user->id, $project->id),
            'recent_photos' => $this->recentPhotos($user->id, $project->id),
            'scope_photo_map' => $this->scopePhotoMap($project->id),
            'meta' => [
                'attendance_statuses' => Attendance::CODES,
                'day_keys' => Attendance::DAY_KEYS,
                'photo_categories' => ProgressPhoto::categories(),
            ],
        ]);
    }

    private function isProjectAssignedTo(User $user, Project $project): bool
    {
        $assignedIds = \DB::table('project_assignments')
            ->where('user_id', $user->id)
            ->pluck('project_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (in_array((int) $project->id, $assignedIds, true)) {
            return true;
        }

        $fullname = trim((string) ($user->fullname ?? ''));
        if ($fullname === '') {
            return false;
        }

        $names = collect(preg_split('/[,;]+/', (string) ($project->assigned ?? '')))
            ->map(fn ($part) => trim((string) $part))
            ->filter();

        return $names->contains($fullname);
    }

    private function weeklySavedByWeek(int $foremanId, int $projectId): array
    {
        // Latest submission wins per scope per week, like the web jotform.
        return WeeklyAccomplishment::query()
            ->where('foreman_id', $foremanId)
            ->where('project_id', $projectId)
            ->orderBy('week_start')
            ->orderBy('id')
            ->get(['week_start', 'scope_of_work', 'percent_completed'])
            ->groupBy(fn (WeeklyAccomplishment $row) => $row->week_start
                ? Carbon::parse($row->week_start)->toDateString()
                : '')
            ->map(function ($rows) {
                return collect($rows)
                    ->groupBy(fn (WeeklyAccomplishment $row) => Str::lower(trim((string) ($row->scope_of_work ?? ''))))
                    ->map(fn ($scopeRows) => $scopeRows->sortBy('id')->last())
                    ->filter()
                    ->map(fn (WeeklyAccomplishment $row) => [
                        'scope_of_work' => trim((string) ($row->scope_of_work ?? '')),
                        'percent_completed' => round((float) ($row->percent_completed ?? 0), 1),
                    ])
                    ->values()
                    ->all();
            })
            ->all();
    }

    private function attendanceWeekPayload(int $foremanId, int $projectId, Carbon $weekStart): array
    {
        $byWeek = $this->attendanceSavedByWeek($foremanId, $projectId);

        return $byWeek[$weekStart->toDateString()] ?? [];
    }

    private function attendanceSavedByWeek(int $foremanId, int $projectId): array
    {
        $rows = Attendance::query()
            ->where('foreman_id', $foremanId)
            ->where('project_id', $projectId)
            ->whereNotNull('date')
            ->orderBy('date')
            ->orderBy('worker_name')
            ->get(['worker_name', 'worker_role', 'date', 'hours', 'attendance_code']);

        $byWeek = [];
        foreach ($rows as $row) {
            if (!$row->date) {
                continue;
            }

            $workerName = trim((string) $row->worker_name);
            if ($workerName === '') {
                continue;
            }

            $workerRole = trim((string) ($row->worker_role ?? Worker::JOB_TYPE_WORKER));
            if ($workerRole === '') {
                $workerRole = Worker::JOB_TYPE_WORKER;
            }
            if (Str::lower($workerRole) === Str::lower(Attendance::ROLE_FOREMAN)) {
                continue;
            }

            $weekKey = Carbon::parse($row->date)->startOfWeek(Carbon::MONDAY)->toDateString();
            $key = Str::lower($workerName.'|'.$workerRole);
            if (!isset($byWeek[$weekKey][$key])) {
                $byWeek[$weekKey][$key] = [
                    'worker_name' => $workerName,
                    'worker_role' => $workerRole,
                    'days' => collect(Attendance::DAY_KEYS)->mapWithKeys(fn (string $day) => [$day => ''])->all(),
                ];
            }

            $dayKey = Attendance::WEEKDAY_SHORT_TO_KEY[Carbon::parse($row->date)->format('D')] ?? null;
            if ($dayKey === null) {
                continue;
            }

            $stored = strtoupper(trim((string) ($row->attendance_code ?? '')));
            $byWeek[$weekKey][$key]['days'][$dayKey] = array_key_exists($stored, Attendance::STATUS_HOURS)
                ? $stored
                : $this->statusFromHours((float) $row->hours);
        }

        return collect($byWeek)->map(
            fn (array $workers) => collect($workers)
                ->sortBy(fn (array $worker) => Str::lower($worker['worker_name']))
                ->values()
                ->all()
        )->all();
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

    private function recentDeliveries(int $foremanId, int $projectId)
    {
        return DeliveryConfirmation::query()
            ->where('foreman_id', $foremanId)
            ->where('project_id', $projectId)
            ->latest()
            ->take(5)
            ->get(['id', 'item_delivered', 'quantity', 'delivery_date', 'supplier', 'status', 'photo_path', 'created_at'])
            ->map(fn (DeliveryConfirmation $delivery) => [
                'id' => $delivery->id,
                'item_delivered' => $delivery->item_delivered,
                'quantity' => $delivery->quantity,
                'delivery_date' => $delivery->delivery_date ? (string) $delivery->delivery_date : null,
                'supplier' => $delivery->supplier,
                'status' => $delivery->status,
                'photo_path' => $delivery->photo_path,
                'created_at' => optional($delivery->created_at)?->toDateTimeString(),
            ])
            ->values();
    }

    private function recentMaterialRequests(int $foremanId, int $projectId)
    {
        return MaterialRequest::query()
            ->where('foreman_id', $foremanId)
            ->where('project_id', $projectId)
            ->latest()
            ->take(5)
            ->get(['id', 'material_name', 'quantity', 'unit', 'remarks', 'status', 'photo_path', 'created_at'])
            ->map(fn (MaterialRequest $requestRow) => [
                'id' => $requestRow->id,
                'material_name' => $requestRow->material_name,
                'quantity' => $requestRow->quantity,
                'unit' => $requestRow->unit,
                'remarks' => $requestRow->remarks,
                'status' => $requestRow->status,
                'photo_path' => $requestRow->photo_path,
                'created_at' => optional($requestRow->created_at)?->toDateTimeString(),
            ])
            ->values();
    }

    private function recentIssueReports(int $foremanId, int $projectId)
    {
        return IssueReport::query()
            ->where('foreman_id', $foremanId)
            ->where('project_id', $projectId)
            ->latest()
            ->take(5)
            ->get(['id', 'issue_title', 'description', 'severity', 'status', 'photo_path', 'created_at'])
            ->map(fn (IssueReport $issueRow) => [
                'id' => $issueRow->id,
                'issue_title' => $issueRow->issue_title,
                'description' => $issueRow->description,
                'severity' => $issueRow->severity,
                'status' => $issueRow->status,
                'photo_path' => $issueRow->photo_path,
                'created_at' => optional($issueRow->created_at)?->toDateTimeString(),
            ])
            ->values();
    }

    private function recentPhotos(int $foremanId, int $projectId)
    {
        // Same as the web jotform: section photos (delivery / material /
        // issue uploads) stay on their own recent cards and are excluded
        // here — only general progress photos are listed.
        return ProgressPhoto::query()
            ->where('foreman_id', $foremanId)
            ->where('project_id', $projectId)
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
                'created_at' => optional($photo->created_at)?->toDateTimeString(),
            ])
            ->values();
    }

    private function scopePhotoMap(int $projectId): array
    {
        $scopeIds = ProjectScope::query()
            ->where('project_id', $projectId)
            ->pluck('id', 'id');

        if ($scopeIds->isEmpty()) {
            return [];
        }

        $scopesById = ProjectScope::query()
            ->where('project_id', $projectId)
            ->get(['id', 'scope_name'])
            ->keyBy(fn (ProjectScope $scope) => (int) $scope->id);

        $map = [];
        $photos = ScopePhoto::query()
            ->whereIn('project_scope_id', $scopesById->keys()->all())
            ->orderByDesc('id')
            ->get(['id', 'project_scope_id', 'photo_path', 'caption', 'created_at']);

        foreach ($photos as $photo) {
            $scope = $scopesById->get((int) $photo->project_scope_id);
            $scopeName = trim((string) ($scope->scope_name ?? ''));
            if ($scopeName === '') {
                continue;
            }

            $key = Str::lower($scopeName);
            $map[$key][] = [
                'id' => (int) $photo->id,
                'photo_path' => $photo->photo_path,
                'caption' => $photo->caption,
                'created_at' => optional($photo->created_at)?->toDateTimeString(),
            ];
        }

        return $map;
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing('detail');
        $photoPath = $user->detail?->profile_photo_path ?? '';

        return [
            'id' => $user->id,
            'fullname' => $user->fullname,
            'email' => $user->email,
            'role' => $user->role,
            'profile_photo_path' => $photoPath,
            'profile_photo_url' => $this->profilePhotoUrl($photoPath),
        ];
    }

    private function accountWithPhotoUrl(array $account): array
    {
        $account['profile_photo_url'] = $this->profilePhotoUrl(
            (string) ($account['profile_photo_path'] ?? '')
        );

        return $account;
    }

    private function profilePhotoUrl(string $path): string
    {
        $path = trim($path);
        if ($path === '') {
            return '';
        }

        return url('/files/'.ltrim($path, '/'));
    }

    private function assignedProjectIds(User $user): array
    {
        $assignedIds = \DB::table('project_assignments')
            ->where('user_id', $user->id)
            ->pluck('project_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($assignedIds->isEmpty() && trim((string) ($user->fullname ?? '')) !== '') {
            $fullname = trim((string) $user->fullname);
            $assignedIds = Project::query()
                ->whereNotNull('assigned')
                ->where('assigned', '!=', '')
                ->get(['id', 'assigned'])
                ->filter(function (Project $project) use ($fullname) {
                    $names = collect(preg_split('/[,;]+/', (string) $project->assigned))
                        ->map(fn ($part) => trim((string) $part))
                        ->filter();

                    return $names->contains($fullname);
                })
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values();
        }

        return $assignedIds->all();
    }

    private function assignedProjects(User $user): array
    {
        $assignedIds = $this->assignedProjectIds($user);

        if (empty($assignedIds)) {
            return [];
        }

        return Project::query()
            ->whereIn('id', $assignedIds)
            ->orderBy('name')
            ->get(['id', 'name', 'client', 'phase', 'status', 'overall_progress'])
            ->map(fn (Project $project) => [
                'id' => $project->id,
                'name' => $project->name,
                'location' => $project->client,
                'client' => $project->client,
                'phase' => $project->phase,
                'status' => $project->status,
                'overall_progress' => (int) ($project->overall_progress ?? 0),
            ])
            ->values()
            ->all();
    }
}
