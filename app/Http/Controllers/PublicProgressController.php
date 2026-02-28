<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\ProgressSubmitToken;
use App\Models\ProjectFile;
use App\Models\ProjectUpdate;
use App\Models\WeeklyAccomplishment;
use App\Models\Worker;
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

        return Inertia::render('Public/ProgressSubmit', [
            'submitToken' => [
                'token' => $submitToken->token,
                'project_id' => $submitToken->project_id,
                'project_name' => $submitToken->project->name,
                'foreman_name' => $submitToken->foreman->fullname,
                'expires_at' => optional($submitToken->expires_at)?->toDateTimeString(),
                'workers' => $workers,
                'weekly_scope_of_works' => self::WEEKLY_SCOPE_OF_WORKS,
                'photo_categories' => self::PHOTO_CATEGORIES,
                'recent_photos' => $recentPhotos,
            ],
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

            'weekly_week_start' => ['nullable', 'date'],
            'weekly_scopes' => ['nullable', 'array'],
            'weekly_scopes.*.scope_of_work' => ['nullable', 'string', 'max:255'],
            'weekly_scopes.*.percent_completed' => ['nullable', 'numeric', 'min:0', 'max:100'],

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

            DeliveryConfirmation::create([
                'project_id' => $submitToken->project_id,
                'foreman_id' => $submitToken->foreman_id,
                'item_delivered' => $itemDelivered !== '' ? $itemDelivered : 'Delivery Confirmation',
                'quantity' => $quantity !== '' ? $quantity : '1',
                'delivery_date' => $deliveryDate,
                'supplier' => trim((string) ($validated['delivery_supplier'] ?? '')) ?: null,
                'status' => $status,
            ]);

            if (isset($validated['delivery_photo'])) {
                $path = $validated['delivery_photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
                $note = trim((string) ($validated['delivery_note'] ?? ''));
                $caption = '[Delivery] ' . ($status === 'received' ? 'Complete' : 'Incomplete');
                if ($note !== '') {
                    $caption .= ' - ' . $note;
                }

                ProgressPhoto::create([
                    'foreman_id' => $submitToken->foreman_id,
                    'project_id' => $submitToken->project_id,
                    'photo_path' => $path,
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
        ]);

        if ($materialTouched) {
            $materialName = trim((string) ($validated['material_name'] ?? ''));
            $materialQuantity = trim((string) ($validated['material_quantity'] ?? ''));
            $materialUnit = trim((string) ($validated['material_unit'] ?? ''));

            if ($materialName === '' || $materialQuantity === '' || $materialUnit === '') {
                throw ValidationException::withMessages([
                    'material_name' => 'Material name, quantity, and unit are required when submitting a material request.',
                ]);
            }

            MaterialRequest::create([
                'foreman_id' => $submitToken->foreman_id,
                'material_name' => $materialName,
                'quantity' => $materialQuantity,
                'unit' => $materialUnit,
                'remarks' => trim((string) ($validated['material_remarks'] ?? '')) ?: null,
                'status' => 'pending',
            ]);

            $submittedAny = true;
        }

        $weeklyScopes = collect($validated['weekly_scopes'] ?? [])
            ->map(function (array $scope) {
                return [
                    'scope_of_work' => trim((string) ($scope['scope_of_work'] ?? '')),
                    'percent_completed' => trim((string) ($scope['percent_completed'] ?? '')),
                ];
            })
            ->filter(fn (array $scope) => $scope['scope_of_work'] !== '' && $scope['percent_completed'] !== '')
            ->values();

        if ($weeklyScopes->isNotEmpty()) {
            $weeklyWeekStart = trim((string) ($validated['weekly_week_start'] ?? ''));
            if ($weeklyWeekStart === '') {
                throw ValidationException::withMessages([
                    'weekly_week_start' => 'Week start is required when submitting weekly progress.',
                ]);
            }

            $weekStart = Carbon::parse($weeklyWeekStart)->toDateString();

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

            IssueReport::create([
                'foreman_id' => $submitToken->foreman_id,
                'issue_title' => $issueTitle,
                'description' => $issueDescription,
                'severity' => $severity,
                'status' => 'open',
            ]);

            if (isset($validated['issue_photo'])) {
                $path = $validated['issue_photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');

                ProgressPhoto::create([
                    'foreman_id' => $submitToken->foreman_id,
                    'project_id' => $submitToken->project_id,
                    'photo_path' => $path,
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

        DeliveryConfirmation::create([
            'project_id' => $submitToken->project_id,
            'foreman_id' => $submitToken->foreman_id,
            'item_delivered' => $itemDelivered !== '' ? $itemDelivered : 'Delivery Confirmation',
            'quantity' => $quantity !== '' ? $quantity : '1',
            'delivery_date' => $validated['delivery_date'],
            'supplier' => trim((string) ($validated['supplier'] ?? '')) ?: null,
            'status' => $status,
        ]);

        if (isset($validated['photo'])) {
            $path = $validated['photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');
            $note = trim((string) ($validated['note'] ?? ''));
            $caption = '[Delivery] ' . ($status === 'received' ? 'Complete' : 'Incomplete');
            if ($note !== '') {
                $caption .= ' - ' . $note;
            }

            ProgressPhoto::create([
                'foreman_id' => $submitToken->foreman_id,
                'project_id' => $submitToken->project_id,
                'photo_path' => $path,
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
        ]);

        MaterialRequest::create([
            'foreman_id' => $submitToken->foreman_id,
            'material_name' => trim((string) $validated['material_name']),
            'quantity' => trim((string) $validated['quantity']),
            'unit' => trim((string) $validated['unit']),
            'remarks' => trim((string) ($validated['remarks'] ?? '')) ?: null,
            'status' => 'pending',
        ]);

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
        ]);

        $weekStart = Carbon::parse($validated['week_start'])->toDateString();

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

        IssueReport::create([
            'foreman_id' => $submitToken->foreman_id,
            'issue_title' => trim((string) $validated['issue_title']),
            'description' => trim((string) $validated['description']),
            'severity' => $severity,
            'status' => 'open',
        ]);

        if (isset($validated['photo'])) {
            $path = $validated['photo']->store('progress-photos/public-token/' . $submitToken->project_id, 'public');

            ProgressPhoto::create([
                'foreman_id' => $submitToken->foreman_id,
                'project_id' => $submitToken->project_id,
                'photo_path' => $path,
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
}
