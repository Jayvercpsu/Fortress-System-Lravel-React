<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\Worker;
use App\Services\PublicProgressService;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ForemanSubmissionController extends Controller
{
    /**
     * Submit-all — same fields, rules and persistence as the web foreman
     * jotform (`POST /progress-submit/{token}/submit-all`), scoped to the
     * authenticated foreman + project instead of a public submit token.
     */
    public function submitAll(Request $request, Project $project, PublicProgressService $progress)
    {
        $user = $request->user();

        if (!$this->isProjectAssignedTo($user, $project)) {
            return response()->json(['message' => 'Project not assigned to this foreman.'], 403);
        }

        $this->ensureProjectEditable($project);

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
        $submitted = [
            'attendance' => false,
            'delivery' => false,
            'material' => false,
            'weekly' => false,
            'photo' => false,
            'issue' => false,
        ];

        DB::beginTransaction();

        try {
            if ($this->storeAttendance($user, $project, $validated)) {
                $submitted['attendance'] = true;
            }

            if ($this->storeDelivery($user, $project, $validated)) {
                $submitted['delivery'] = true;
            }

            if ($this->storeMaterial($user, $project, $validated)) {
                $submitted['material'] = true;
            }

            if ($this->storeWeekly($user, $project, $validated, $progress)) {
                $submitted['weekly'] = true;
            }

            if ($this->storePhoto($user, $project, $validated)) {
                $submitted['photo'] = true;
            }

            if ($this->storeIssue($user, $project, $validated)) {
                $submitted['issue'] = true;
            }

            if (!in_array(true, $submitted, true)) {
                throw ValidationException::withMessages([
                    'submit_all' => __('messages.public_progress.submit_any_required'),
                ]);
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        return response()->json([
            'message' => __('messages.public_progress.jotform_submitted'),
            'submitted' => $submitted,
        ]);
    }

    public function destroyDelivery(Request $request, DeliveryConfirmation $deliveryConfirmation)
    {
        return $this->destroyRecord(
            $request->user(),
            $deliveryConfirmation,
            'photo_path',
            fn ($user, $projectId, $photoPath) => ProgressPhoto::query()
                ->where('foreman_id', $user->id)
                ->where('project_id', $projectId)
                ->where('photo_path', $photoPath)
                ->where('caption', 'like', '[Delivery]%')
                ->delete()
        );
    }

    public function destroyMaterial(Request $request, MaterialRequest $materialRequest)
    {
        return $this->destroyRecord(
            $request->user(),
            $materialRequest,
            'photo_path',
            fn ($user, $projectId, $photoPath) => ProgressPhoto::query()
                ->where('foreman_id', $user->id)
                ->where('project_id', $projectId)
                ->where('photo_path', $photoPath)
                ->where('caption', 'like', '[Material]%')
                ->delete()
        );
    }

    public function destroyPhoto(Request $request, ProgressPhoto $progressPhoto)
    {
        $user = $request->user();

        if ((int) $progressPhoto->foreman_id !== (int) $user->id) {
            return response()->json(['message' => 'Record not found.'], 404);
        }

        $path = $progressPhoto->photo_path;
        $progressPhoto->delete();
        UploadManager::delete($path);

        return response()->json(['message' => 'Photo deleted.']);
    }

    public function destroyIssue(Request $request, IssueReport $issueReport)
    {
        return $this->destroyRecord(
            $request->user(),
            $issueReport,
            'photo_path',
            fn ($user, $projectId, $photoPath) => ProgressPhoto::query()
                ->where('foreman_id', $user->id)
                ->where('project_id', $projectId)
                ->where('photo_path', $photoPath)
                ->where('caption', 'like', '[Issue]%')
                ->delete()
        );
    }

    public function destroyScopePhoto(Request $request, ScopePhoto $scopePhoto)
    {
        $user = $request->user();
        $scopePhoto->loadMissing('scope');

        $projectId = (int) ($scopePhoto->scope?->project_id ?? 0);
        $project = $projectId > 0 ? Project::find($projectId) : null;

        if (!$project || !$this->isProjectAssignedTo($user, $project)) {
            return response()->json(['message' => 'Record not found.'], 404);
        }

        $path = $scopePhoto->photo_path;
        $scopePhoto->delete();
        UploadManager::delete($path);

        return response()->json(['message' => 'Photo deleted.']);
    }

    private function destroyRecord(User $user, $record, string $photoField, callable $deleteLinkedPhotos)
    {
        if ((int) $record->foreman_id !== (int) $user->id) {
            return response()->json(['message' => 'Record not found.'], 404);
        }

        $photoPath = $record->{$photoField};
        $projectId = $record->project_id;
        $record->delete();

        if ($photoPath) {
            $deleteLinkedPhotos($user, $projectId, $photoPath);
            UploadManager::delete($photoPath);
        }

        return response()->json(['message' => 'Record deleted.']);
    }

    private function isProjectAssignedTo(User $user, Project $project): bool
    {
        $assignedIds = DB::table('project_assignments')
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

    private function ensureProjectEditable(Project $project): void
    {
        $phase = Str::lower(trim((string) ($project->phase ?? '')));
        $status = Str::lower(trim((string) ($project->status ?? '')));
        $cancelledValues = ['cancelled', 'canceled'];
        $completedValues = ['completed', 'complete', 'done'];

        if (in_array($phase, $cancelledValues, true) || in_array($status, $cancelledValues, true)) {
            abort(403, 'This project is cancelled and no longer accepts submissions.');
        }

        if (in_array($phase, $completedValues, true) || in_array($status, $completedValues, true)) {
            abort(403, 'This project is completed and no longer accepts submissions.');
        }
    }

    private function photoDir(Project $project): string
    {
        return 'progress-photos/foreman/' . $project->id;
    }

    private function hasAnyText(array $values): bool
    {
        foreach ($values as $value) {
            if (trim((string) $value) !== '') {
                return true;
            }
        }

        return false;
    }

    private function isForemanRole(?string $role): bool
    {
        return Str::lower(trim((string) $role)) === Str::lower(Attendance::ROLE_FOREMAN);
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

    private function storeAttendance(User $user, Project $project, array $validated): bool
    {
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
            ->filter(fn (array $row) => $row['worker_name'] !== '')
            ->values();

        if ($attendanceEntries->isEmpty()) {
            return false;
        }

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

        $this->syncWorkers($user, $project, $attendanceEntries);

        $weekStart = Carbon::parse($selectedWeekStart, 'Asia/Manila');

        foreach ($attendanceEntries as $entry) {
            $deleteDates = [];
            foreach (Attendance::DAY_KEYS as $dayKey) {
                $status = $entry['days'][$dayKey] ?? '';
                $date = $weekStart->copy()->addDays(Attendance::DAY_OFFSETS[$dayKey])->toDateString();
                if ($status === '') {
                    $deleteDates[] = $date;
                    continue;
                }

                $hours = (float) (Attendance::STATUS_HOURS[$status] ?? 0);

                Attendance::updateOrCreate(
                    [
                        'foreman_id' => $user->id,
                        'project_id' => $project->id,
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

            if (!empty($deleteDates)) {
                Attendance::query()
                    ->where('foreman_id', $user->id)
                    ->where('project_id', $project->id)
                    ->where('worker_name', $entry['worker_name'])
                    ->where('worker_role', $entry['worker_role'])
                    ->whereIn('date', $deleteDates)
                    ->delete();
            }
        }

        return true;
    }

    private function syncWorkers(User $user, Project $project, $attendanceEntries): void
    {
        $foremanNameKey = Str::lower(trim((string) ($user->fullname ?? '')));
        $normalizedNames = collect($attendanceEntries)
            ->filter(fn ($entry) => !$this->isForemanRole($entry['worker_role'] ?? ''))
            ->map(function ($entry) use ($foremanNameKey) {
                $name = trim((string) (($entry['worker_name'] ?? '')));

                return ($foremanNameKey !== '' && Str::lower($name) === $foremanNameKey) ? '' : $name;
            })
            ->filter(fn (string $name) => $name !== '')
            ->unique(fn (string $name) => Str::lower($name))
            ->values();

        foreach ($normalizedNames as $workerName) {
            $worker = Worker::query()
                ->where('foreman_id', $user->id)
                ->whereRaw('LOWER(name) = ?', [Str::lower($workerName)])
                ->first();

            if (!$worker) {
                Worker::create([
                    'foreman_id' => $user->id,
                    'project_id' => $project->id,
                    'name' => $workerName,
                ]);
                continue;
            }

            if ($worker->project_id === null) {
                $worker->project_id = $project->id;
                $worker->save();
            }
        }
    }

    private function storeDelivery(User $user, Project $project, array $validated): bool
    {
        $deliveryTouched = $this->hasAnyText([
            $validated['delivery_item_delivered'] ?? null,
            $validated['delivery_quantity'] ?? null,
            $validated['delivery_supplier'] ?? null,
            $validated['delivery_note'] ?? null,
        ]) || isset($validated['delivery_photo']);

        if (!$deliveryTouched) {
            return false;
        }

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
        $note = trim((string) ($validated['delivery_note'] ?? ''));
        $deliveryPhotoPath = null;

        if (isset($validated['delivery_photo'])) {
            $deliveryPhotoPath = UploadManager::store(
                $validated['delivery_photo'],
                $this->photoDir($project)
            );
        }

        DeliveryConfirmation::create([
            'project_id' => $project->id,
            'foreman_id' => $user->id,
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

            ProgressPhoto::create([
                'foreman_id' => $user->id,
                'project_id' => $project->id,
                'photo_path' => $deliveryPhotoPath,
                'caption' => $caption,
            ]);
        }

        return true;
    }

    private function storeMaterial(User $user, Project $project, array $validated): bool
    {
        $materialTouched = $this->hasAnyText([
            $validated['material_name'] ?? null,
            $validated['material_quantity'] ?? null,
            $validated['material_unit'] ?? null,
            $validated['material_remarks'] ?? null,
        ]) || isset($validated['material_photo']);

        if (!$materialTouched) {
            return false;
        }

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
                $this->photoDir($project)
            );
        }

        MaterialRequest::create([
            'project_id' => $project->id,
            'foreman_id' => $user->id,
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

            ProgressPhoto::create([
                'foreman_id' => $user->id,
                'project_id' => $project->id,
                'photo_path' => $materialPhotoPath,
                'caption' => $caption,
            ]);
        }

        return true;
    }

    private function storeWeekly(User $user, Project $project, array $validated, PublicProgressService $progress): bool
    {
        $weeklyScopes = collect($validated['weekly_scopes'] ?? [])
            ->map(function (array $scope) {
                return [
                    'scope_of_work' => trim((string) ($scope['scope_of_work'] ?? '')),
                    'percent_completed' => $scope['percent_completed'] ?? null,
                    'photo_caption' => trim((string) ($scope['photo_caption'] ?? '')),
                    'photos' => collect($scope['photos'] ?? [])
                        ->filter(fn ($photo) => $photo instanceof \Illuminate\Http\UploadedFile)
                        ->values()
                        ->all(),
                ];
            })
            ->filter(fn (array $scope) => $scope['scope_of_work'] !== '')
            ->values();

        $weeklyRemovedScopes = collect($validated['weekly_removed_scopes'] ?? [])
            ->map(fn ($scope) => trim((string) $scope))
            ->filter(fn (string $scope) => $scope !== '')
            ->unique(fn (string $scope) => Str::lower($scope))
            ->values();

        if ($weeklyScopes->isEmpty() && $weeklyRemovedScopes->isEmpty()) {
            return false;
        }

        $weeklyWeekStart = trim((string) ($validated['weekly_week_start'] ?? ''));
        if ($weeklyWeekStart === '') {
            throw ValidationException::withMessages([
                'weekly_week_start' => __('messages.public_progress.weekly_week_start_required'),
            ]);
        }

        $progress->saveWeeklyProgress(
            (int) $project->id,
            (int) $user->id,
            trim((string) ($user->fullname ?? '')),
            trim((string) $weeklyWeekStart),
            $weeklyScopes->all(),
            $weeklyRemovedScopes->all(),
            true,
            (int) $user->id
        );

        return true;
    }

    private function storePhoto(User $user, Project $project, array $validated): bool
    {
        $photoTouched = isset($validated['photo_file']) || $this->hasAnyText([
            $validated['photo_category'] ?? null,
            $validated['photo_description'] ?? null,
        ]);

        if (!$photoTouched) {
            return false;
        }

        if (!isset($validated['photo_file'])) {
            throw ValidationException::withMessages([
                'photo_file' => __('messages.public_progress.photo_required'),
            ]);
        }

        $path = UploadManager::store(
            $validated['photo_file'],
            $this->photoDir($project)
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
        $caption = count($captionParts) > 0 ? implode(' ', $captionParts) : 'Mobile photo upload';

        ProgressPhoto::create([
            'foreman_id' => $user->id,
            'project_id' => $project->id,
            'photo_path' => $path,
            'caption' => $caption,
        ]);

        return true;
    }

    private function storeIssue(User $user, Project $project, array $validated): bool
    {
        $issueTouched = isset($validated['issue_photo']) || $this->hasAnyText([
            $validated['issue_title'] ?? null,
            $validated['issue_description'] ?? null,
        ]);

        if (!$issueTouched) {
            return false;
        }

        $issueTitle = trim((string) ($validated['issue_title'] ?? ''));
        $issueDescription = trim((string) ($validated['issue_description'] ?? ''));
        $issueUrgency = trim((string) ($validated['issue_urgency'] ?? IssueReport::URGENCY_MEDIUM));

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
                $this->photoDir($project)
            );
        }

        IssueReport::create([
            'project_id' => $project->id,
            'foreman_id' => $user->id,
            'issue_title' => $issueTitle,
            'description' => $issueDescription,
            'severity' => $severity,
            'status' => IssueReport::STATUS_OPEN,
            'photo_path' => $issuePhotoPath,
        ]);

        if ($issuePhotoPath !== null) {
            ProgressPhoto::create([
                'foreman_id' => $user->id,
                'project_id' => $project->id,
                'photo_path' => $issuePhotoPath,
                'caption' => '[Issue] ' . $issueTitle,
            ]);
        }

        return true;
    }
}
