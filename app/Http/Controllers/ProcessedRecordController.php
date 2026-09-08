<?php

namespace App\Http\Controllers;

use App\Models\ProcessedRecord;
use App\Models\Project;
use App\Models\Attendance;
use App\Models\Expense;
use App\Models\Worker;
use App\Repositories\Contracts\BuildRepositoryInterface;
use App\Services\OpenRouterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessedRecordController extends Controller
{
    public function __construct(
        protected OpenRouterService $openRouter,
        protected BuildRepositoryInterface $buildRepository
    ) {}

    /**
     * List processed records for a project.
     */
    public function index(Request $request, Project $project): JsonResponse
    {
        $records = ProcessedRecord::where('project_id', $project->id)
            ->with('user:id,fullname')
            ->latest()
            ->paginate(15);

        return response()->json($records);
    }

    /**
     * Upload without a specific project — fully auto-detect.
     */
    public function storeAutoDetect(Request $request): JsonResponse
    {
        return $this->processUpload($request);
    }

    /**
     * Prepare an image for AI processing by resizing and compressing.
     * This improves OCR accuracy for handwritten documents.
     * Falls back to raw image if GD extension is not available.
     */
    protected function prepareImageForAI($file, ?\Intervention\Image\ImageManager $manager): array
    {
        // If GD is not available, send raw image
        if (!$manager) {
            return [
                'base64' => base64_encode(file_get_contents($file->getRealPath())),
                'mime'   => $file->getMimeType(),
            ];
        }

        $maxWidth = 2048;
        $maxHeight = 2048;
        $quality = 100;

        try {
            $img = $manager->read($file->getRealPath());

            // Resize if larger than max dimensions, maintaining aspect ratio
            $width = $img->width();
            $height = $img->height();

            if ($width > $maxWidth || $height > $maxHeight) {
                $img->scaleDown($maxWidth, $maxHeight);
            }

            // Convert to JPEG for consistent processing
            $encoded = $img->toJpeg($quality);
            $mime = 'image/jpeg';

            return [
                'base64' => base64_encode((string) $encoded),
                'mime'   => $mime,
            ];
        } catch (\Exception $e) {
            // Fallback to raw image if processing fails
            Log::warning('Image preprocessing failed, using raw image', [
                'error' => $e->getMessage(),
            ]);

            return [
                'base64' => base64_encode(file_get_contents($file->getRealPath())),
                'mime'   => $file->getMimeType(),
            ];
        }
    }

    /**
     * Upload multiple images and process them with AI.
     */
    public function store(Request $request, Project $project): JsonResponse
    {
        return $this->processUpload($request, $project);
    }

    /**
     * Core upload processing logic — ALL OR NOTHING.
     *
     * If AI fails on ANY image → NONE are saved.
     * If AI succeeds on ALL images → ALL go to confirmation.
     */
    protected function processUpload(Request $request, ?Project $project = null): JsonResponse
    {
        $request->validate([
            'images'    => 'required|array|min:1|max:5',
            'images.*'  => 'required|image|max:10240',
            'notes'     => 'nullable|string|max:500',
            'mode'      => 'nullable|string|in:general,attendance',
            'project_id' => 'nullable|integer|exists:projects,id',
        ], [
            'images.required'   => 'Please select at least one image to upload.',
            'images.min'        => 'Please select at least one image to upload.',
            'images.max'        => 'You can upload a maximum of 5 images at once.',
            // Per-index messages so users see "first image" instead of "images.0"
            'images.0.required' => 'The first image must be a valid file.',
            'images.0.image'    => 'The first image must be a valid image (JPG or PNG).',
            'images.0.max'      => 'The first image must be less than 10MB.',
            'images.1.required' => 'The second image must be a valid file.',
            'images.1.image'    => 'The second image must be a valid image (JPG or PNG).',
            'images.1.max'      => 'The second image must be less than 10MB.',
            'images.2.required' => 'The third image must be a valid file.',
            'images.2.image'    => 'The third image must be a valid image (JPG or PNG).',
            'images.2.max'      => 'The third image must be less than 10MB.',
            'images.3.required' => 'The fourth image must be a valid file.',
            'images.3.image'    => 'The fourth image must be a valid image (JPG or PNG).',
            'images.3.max'      => 'The fourth image must be less than 10MB.',
            'images.4.required' => 'The fifth image must be a valid file.',
            'images.4.image'    => 'The fifth image must be a valid image (JPG or PNG).',
            'images.4.max'      => 'The fifth image must be less than 10MB.',
        ]);

        $images = $request->file('images');
        $user = $request->user();
        $storageProjectId = $project?->id ?? $request->input('project_id');

        // Allow more time for AI processing of multiple images (5 images can be slow)
        set_time_limit(300);

        // NOTE: old stale pending records are cleaned up only after this
        // batch parses successfully (see step 4). Cleaning upfront orphaned
        // the review list whenever a re-upload failed, so submit then 404'd
        // with "No query results for model [App\Models\ProcessedRecord]".

        // 1. Get all existing projects for AI to match against (only active projects)
        $existingProjects = Project::select('id', 'name', 'client', 'phase', 'status')
            ->whereIn('status', ['active', 'in_progress', null])
            ->get()
            ->map(fn($p) => "ID: {$p->id} | {$p->name} | Client: {$p->client} | Phase: {$p->phase}")
            ->implode("\n");

        $mode = $request->input('mode', 'general');
        $projectCategories = Expense::defaultCategories();
        $systemPrompt = OpenRouterService::getSystemPrompt($projectCategories);
        $scopeContext = $this->buildScopeContext($storageProjectId);
        $prompt = $this->buildUserPrompt($existingProjects, $request->notes, $mode, $projectCategories, $scopeContext);

        // 2. Prepare all images for AI processing (NOT saved to disk)
        // Resize and optimize images for better AI detection accuracy
        $imagePayloads = [];
        $useGd = extension_loaded('gd');
        $manager = $useGd ? new \Intervention\Image\ImageManager(new \Intervention\Image\Drivers\Gd\Driver()) : null;

        foreach ($images as $file) {
            $imagePayloads[] = $this->prepareImageForAI($file, $manager);
        }

        // 3. Call OpenRouter with system prompt (with retry on rate limit)
        $model = config('services.openrouter.model', 'openrouter/free');

        // 3. Process each image separately so records map to the correct image preview.
        // When 1 image produces multiple records (e.g. attendance + expense),
        // all those records share the same image_index.
        // Parsed rows are collected first and persisted in step 4, so a
        // failed batch never wipes the previous review list.
        $records = [];
        $pendingCreates = [];
        $skippedCount = 0;
        $irrelevantCount = 0;
        $lastApiError = null;

        foreach ($imagePayloads as $imageIndex => $imagePayload) {
            $singlePrompt = $this->buildUserPrompt($existingProjects, $request->notes, $mode, $projectCategories, $scopeContext);
            $singleResponse = $this->openRouter->chat($model, $singlePrompt, [$imagePayload], $systemPrompt);

            // Retry once on 429 rate limit
            if (isset($singleResponse['status']) && $singleResponse['status'] == 429) {
                sleep(5);
                $singleResponse = $this->openRouter->chat($model, $singlePrompt, [$imagePayload], $systemPrompt);
            }

            // Skip failed images
            if (isset($singleResponse['error']) && $singleResponse['error']) {
                Log::warning('AI failed for image', ['index' => $imageIndex, 'error' => $singleResponse['message'] ?? 'unknown']);
                $lastApiError = $singleResponse;
                $skippedCount++;
                continue;
            }

            $content = OpenRouterService::extractContent($singleResponse);
            if (empty($content)) {
                $skippedCount++;
                continue;
            }

            $parsedResults = $this->parseMultiRecordResponse($content);
            if (empty($parsedResults)) {
                $skippedCount++;
                continue;
            }

            // All records from this image share the same image_index
            foreach ($parsedResults as $imageResult) {
                if (!$imageResult) {
                    $skippedCount++;
                    continue;
                }

                // The AI explicitly classified the image as not a construction/attendance
                // document. Track this separately so we can show a clear "not related to
                // attendance" message instead of the generic processing-failed one.
                if ($imageResult['type'] === 'irrelevant') {
                    $irrelevantCount++;
                    $skippedCount++;
                    continue;
                }

                $suggestedProjectId = $this->resolveProjectId($imageResult['project'] ?? null, $storageProjectId);

                $parsedData = $imageResult['data'] ?? null;
                if (($imageResult['type'] ?? null) === 'accomplishment' && $suggestedProjectId && is_array($parsedData['scopes'] ?? null)) {
                    // Project-first matching: the extraction prompt only carries
                    // a scope list when the project was pre-selected, so when
                    // the AI guessed the project itself, let the AI resolve the
                    // image scopes against that project's Scope of Works now.
                    if ((int) ($storageProjectId ?? 0) !== (int) $suggestedProjectId) {
                        $parsedData['scopes'] = $this->aiResolveScopeNames($parsedData['scopes'], (int) $suggestedProjectId, $model);
                    }
                    $parsedData['scopes'] = $this->canonicalizeScopeNames((int) $suggestedProjectId, $parsedData['scopes']);
                    foreach ($parsedData['scopes'] as $scopeIndex => $scopeRow) {
                        if (is_array($scopeRow)) {
                            $parsedData['scopes'][$scopeIndex]['remarks'] = $this->sanitizeAiRemarks($scopeRow['remarks'] ?? '');
                        }
                    }
                }

                $pendingCreates[] = [
                    'project_id'     => $suggestedProjectId,
                    'user_id'        => $user?->id,
                    'record_type'    => $imageResult['type'],
                    'image_index'    => $imageIndex,
                    'ocr_raw_text'   => $imageResult['raw_text'] ?? $content,
                    'ai_parsed_data' => $parsedData,
                    'ai_summary'     => $imageResult['summary'] ?? $content,
                    'ai_model'       => $model,
                    'status'         => $suggestedProjectId ? 'pending' : 'pending_project',
                    'notes'          => $request->notes,
                ];
            }
        }

        // 4. Persist the new batch. Only now (a batch actually parsed) clean
        // up old stale pending records from previous uploads, so only the
        // current batch is included in confirm/submit.
        if (!empty($pendingCreates)) {
            $cleanupQuery = ProcessedRecord::whereIn('status', ['pending', 'pending_project']);
            if ($user) {
                $cleanupQuery->where('user_id', $user->id);
            } else {
                // Public mode: clean up records without a project and without user (orphaned)
                $cleanupQuery->whereNull('user_id');
            }
            $cleanupQuery->each(fn($oldRecord) => $oldRecord->delete());

            foreach ($pendingCreates as $attributes) {
                $records[] = ProcessedRecord::create($attributes)->load(['user:id,fullname', 'project:id,name']);
            }
        }

        // If ALL images failed or produced nothing relevant
        if (empty($records) && $skippedCount > 0 && $skippedCount === count($images)) {
            // When every image was explicitly classified as "irrelevant" (i.e. the AI
            // recognized the image but it is NOT an attendance/construction document),
            // tell the user directly that their image isn't related to attendance instead
            // of the generic "could not process" error.
            if ($irrelevantCount > 0 && $irrelevantCount === count($images)) {
                $errorMessage = $mode === 'attendance'
                    ? 'The uploaded image is not related to attendance. Please upload a clear photo of an attendance sheet (names and attendance marks).'
                    : 'The uploaded image does not appear to be a construction record. Please upload a clearer image of an attendance sheet or expense receipt.';
            } else {
                // Use specific error message if available (e.g. insufficient credits)
                $errorMessage = 'AI could not process any of the uploaded images. Please try again with clearer images.';
                if ($lastApiError && isset($lastApiError['code']) && $lastApiError['code'] === 'insufficient_credits') {
                    $errorMessage = $lastApiError['message'];
                } elseif ($lastApiError && isset($lastApiError['message'])) {
                    $errorMessage = $lastApiError['message'];
                }
            }

            return response()->json([
                'error' => true,
                'message' => $errorMessage,
                'saved' => 0,
                'failed' => $skippedCount,
            ], 422);
        }

        if (empty($records)) {
            return response()->json([
                'message' => 'No construction records found in the uploaded images.',
                'records' => [],
                'skipped' => $skippedCount,
                'saved' => 0,
            ]);
        }

        // Mode-based filtering
        if ($mode === 'attendance') {
            // Filter to only attendance records
            $nonAttendance = array_filter($records, fn($r) => $r->record_type !== 'attendance');
            $attendanceRecords = array_filter($records, fn($r) => $r->record_type === 'attendance');

            // Delete non-attendance records that were created
            foreach ($nonAttendance as $record) {
                $record->delete();
            }

            $records = array_values($attendanceRecords);

            // If non-attendance records were found, include a message
            $nonAttendanceMessage = null;
            if (count($nonAttendance) > 0) {
                $nonAttendanceMessage = 'Only attendance records are supported in this mode. ' . count($nonAttendance) . ' non-attendance record(s) were skipped.';
            }

            if (empty($records)) {
                return response()->json([
                    'message' => $nonAttendanceMessage ?? 'No attendance records found in the uploaded images.',
                    'records' => [],
                    'skipped' => $skippedCount + count($nonAttendance),
                    'saved' => 0,
                ]);
            }

            return response()->json([
                'records' => $records,
                'skipped' => $skippedCount + count($nonAttendance),
                'saved' => count($records),
                'summary' => $this->buildBatchSummary($records),
                'mode_message' => $nonAttendanceMessage,
                'accomplishment_context' => $this->accomplishmentContextMap($records),
            ]);
        }

        return response()->json([
            'records' => $records,
            'skipped' => $skippedCount,
            'saved' => count($records),
            'summary' => $this->buildBatchSummary($records),
            'accomplishment_context' => $this->accomplishmentContextMap($records),
        ]);
    }

    /**
     * Submit a record — save to actual attendances/expenses table immediately.
     */
    public function confirm(Request $request, ProcessedRecord $record): JsonResponse
    {
        if ($record->status === 'submitted') {
            return response()->json(['message' => 'Record already submitted'], 422);
        }

        if (!$record->project_id) {
            return response()->json(['message' => 'Please assign a project before submitting'], 422);
        }

        try {
            DB::beginTransaction();

            $parsedData = $record->ai_parsed_data;

            if ($record->record_type === 'attendance') {
                $this->createAttendanceRecords($record, $parsedData);
                // Auto-sync detected worker rates to Worker Rate Management
                $this->syncWorkerRates($parsedData, $record->project_id, $record->user_id);
            } elseif ($record->record_type === 'expense') {
                $this->createExpenseRecord($record, $parsedData);
            } elseif ($record->record_type === 'accomplishment') {
                $scopeErrors = $this->validateAccomplishmentAssignees($record, $parsedData);
                if (!empty($scopeErrors)) {
                    DB::rollBack();

                    return response()->json([
                        'message' => 'Some scopes still need a foreman. Please assign a foreman for each highlighted scope.',
                        'errors' => $scopeErrors,
                    ], 422);
                }
                $result = $this->createAccomplishmentRecords($record, $parsedData);
                $accomplishmentMessage = "Accomplishment saved: {$result['updated']} scope(s) updated, {$result['created']} new scope(s) added.";
            }

            $record->update(['status' => 'submitted']);
            $record->load(['user:id,fullname', 'project:id,name']);

            DB::commit();

            return response()->json([
                'record' => $record,
                'message' => $accomplishmentMessage ?? 'Record submitted and saved to project',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to submit record', ['exception' => $e->getMessage()]);

            return response()->json([
                'message' => 'Failed to save record: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Re-check an accomplishment record's detected scopes against its
     * (possibly newly assigned) project's Scope of Works using the AI,
     * with the deterministic matcher as fallback. Best-effort: never fails,
     * so the review flow can call it right after assigning a project.
     */
    public function resolveScopes(Request $request, ProcessedRecord $record): JsonResponse
    {
        $parsedData = $record->ai_parsed_data;
        $resolved = 0;

        if ($record->record_type === 'accomplishment' && $record->project_id && is_array($parsedData['scopes'] ?? null)) {
            $before = collect($parsedData['scopes'])
                ->map(fn ($scope) => is_array($scope) ? trim((string) ($scope['scope_name'] ?? '')) : '')
                ->all();

            $model = config('services.openrouter.model', 'openrouter/free');
            $scopes = $this->aiResolveScopeNames($parsedData['scopes'], (int) $record->project_id, $model);
            $scopes = $this->canonicalizeScopeNames((int) $record->project_id, $scopes);
            $parsedData['scopes'] = $scopes;

            foreach ($scopes as $index => $scope) {
                $after = is_array($scope) ? trim((string) ($scope['scope_name'] ?? '')) : '';
                if ($after !== '' && $after !== ($before[$index] ?? '')) {
                    $resolved++;
                }
            }

            $record->update(['ai_parsed_data' => $parsedData]);
            $record->load(['user:id,fullname', 'project:id,name']);
        }

        return response()->json([
            'record' => $record,
            'resolved' => $resolved,
            'message' => $resolved > 0
                ? "AI matched {$resolved} scope(s) to the project."
                : 'Scope check complete.',
        ]);
    }

    /**
     * Edit a record's data before confirmation.
     */
    public function edit(Request $request, ProcessedRecord $record): JsonResponse
    {
        $request->validate([
            'ai_parsed_data' => 'required|array',
        ]);

        $record->update([
            'ai_parsed_data' => $request->ai_parsed_data,
        ]);

        $record->load(['user:id,fullname', 'project:id,name']);

        return response()->json([
            'record' => $record,
        ]);
    }

    /**
     * Assign a project to a record (for pending_project records).
     */
    public function assignProject(Request $request, ProcessedRecord $record): JsonResponse
    {
        $request->validate([
            'project_id' => 'required|exists:projects,id',
        ]);

        $record->update([
            'project_id' => $request->project_id,
            'status' => 'pending',
        ]);

        $record->load(['user:id,fullname', 'project:id,name']);

        return response()->json([
            'record' => $record,
            'accomplishment_context' => $this->accomplishmentContextForProject((int) $record->project_id),
        ]);
    }

    /**
     * Reject a record.
     */
    public function reject(ProcessedRecord $record): JsonResponse
    {
        // Delete the record entirely so nothing is saved to attendance/expense tables
        $record->delete();

        return response()->json([
            'message' => 'Record rejected',
        ]);
    }

    /**
     * Update a processed record.
     */
    public function update(Request $request, Project $project, ProcessedRecord $record): JsonResponse
    {
        $request->validate([
            'status'     => 'nullable|in:confirmed,rejected,pending,pending_project',
            'notes'      => 'nullable|string|max:500',
            'project_id' => 'nullable|exists:projects,id',
        ]);

        $record->update($request->only(['status', 'notes', 'project_id']));

        return response()->json([
            'record' => $record->load('user:id,fullname'),
        ]);
    }

    /**
     * Delete a processed record.
     */
    public function destroy(Project $project, ProcessedRecord $record): JsonResponse
    {
        $record->delete();

        return response()->json(['message' => 'Record deleted']);
    }

    /**
     * Quick create a project from AI detection.
     */
    public function quickCreateProject(Request $request): JsonResponse
    {
        $request->validate([
            'name'     => 'required|string|max:255',
            'code'     => 'nullable|string|max:50',
            'client'   => 'nullable|string|max:255',
            'type'     => 'nullable|string|max:255',
            'location' => 'nullable|string|max:255',
            'phase'    => 'required|in:Design,Construction,Completed',
        ]);

        $project = Project::create([
            'name'     => $request->name,
            'client'   => $request->client,
            'type'     => $request->input('type', 'Residential'),
            'location' => $request->input('location', 'TBD'),
            'phase'    => $request->phase,
            'status'   => 'active',
        ]);

        return response()->json([
            'project' => $project,
            'message' => 'Project created successfully',
        ]);
    }

    /**
     * Create attendance records from parsed data.
     */
    protected function createAttendanceRecords(ProcessedRecord $record, ?array $parsedData): void
    {
        if (!$parsedData || !isset($parsedData['workers'])) {
            return;
        }

        $projectId = $record->project_id;
        $foremanId = $record->user_id;

        // If no user (public/JotForm), derive foreman from the active submit token
        // for this project. This ensures the attendance records use the same foreman_id
        // that the Submit All flow (storeAll) will use.
        if (!$foremanId && $projectId) {
            $submitToken = \App\Models\ProgressSubmitToken::where('project_id', $projectId)
                ->whereNull('revoked_at')
                ->latest()
                ->first();
            $foremanId = $submitToken?->foreman_id ?? $this->getProjectForemanId($projectId);
        }

        foreach ($parsedData['workers'] as $worker) {
            $workerName = $worker['name'] ?? 'Unknown';
            $workerRole = $worker['position'] ?? 'Laborer';

            $recordsCreated = 0;
            $hadParsableDates = false;

            // Format 1: Daily attendance map — {"8/16": "P", "8/17": "A", ...}
            if (isset($worker['attendance']) && is_array($worker['attendance'])) {
                // Determine the year from parsed data
                $dateRange = $parsedData['date_range'] ?? $parsedData['date_range_start'] ?? '';
                $year = date('Y');
                if (preg_match('/(\d{4})/', $dateRange, $ym)) {
                    $year = $ym[1];
                }

                foreach ($worker['attendance'] as $dayKey => $status) {
                    // Convert "8/16" or "Mon 8/24" to Y-m-d
                    $dayDate = $this->parseAttendanceDay($dayKey, $year);
                    if (!$dayDate) continue;
                    $hadParsableDates = true;

                    // Only create record for Present days
                    $statusCode = strtoupper(trim($status));
                    if ($statusCode !== 'P' && $statusCode !== '1') continue;

                    Attendance::create([
                        'foreman_id'  => $foremanId,
                        'project_id' => $projectId,
                        'worker_name' => $workerName,
                        'worker_role' => $workerRole,
                        'date'        => $dayDate,
                        'hours'       => 8,
                    ]);
                    $recordsCreated++;
                }
            }

            // Format 2: Single-day — {"date": "2026-08-24", "hours": 9.5}
            // Also handles date ranges like "2026-08-26 to 2026-08-27" — uses first date
            //
            // When the attendance map yielded no records AND no usable dates (e.g. a
            // dateless attendance sheet that returned an empty "attendance" map), fall
            // back to this single-row format so the detected worker is still persisted
            // instead of silently dropping out of the daily attendance after refresh.
            if ($recordsCreated === 0 && !$hadParsableDates) {
                $date = $this->parseFlexibleDate($parsedData['date'] ?? null)
                    ?? $this->parseFlexibleDate($parsedData['date_range_start'] ?? null)
                    ?? date('Y-m-d');

                $hours = $worker['hours'] ?? ($worker['days_present'] ?? 8);
                if (!is_numeric($hours)) {
                    $hours = 8;
                }

                Attendance::create([
                    'foreman_id'  => $foremanId,
                    'project_id' => $projectId,
                    'worker_name' => $workerName,
                    'worker_role' => $workerRole,
                    'date'        => $date,
                    'hours'       => (float) $hours,
                ]);
            }
        }
    }

    /**
     * Get the foreman ID assigned to a project.
     * Falls back to head admin if no foreman is assigned.
     */
    protected function getProjectForemanId(int $projectId): ?int
    {
        $project = \App\Models\Project::with('foremen')->find($projectId);
        if ($project && $project->foremen->isNotEmpty()) {
            return $project->foremen->first()->id;
        }
        // Fallback: first head_admin user
        $headAdmin = \App\Models\User::where('role', 'head_admin')->first();
        return $headAdmin?->id;
    }

    /**
     * Sync AI-detected worker rates to Worker Rate Management.
     *
     * For each worker with a detected daily_rate:
     * - If worker exists in workers table (by name): update default_rate_per_hour
     * - If worker does not exist: create a new Worker record with the rate
     */
    protected function syncWorkerRates(?array $parsedData, ?int $projectId, ?int $foremanId): void
    {
        if (!$parsedData || !isset($parsedData['workers']) || !$projectId) {
            return;
        }

        foreach ($parsedData['workers'] as $worker) {
            $workerName = trim($worker['name'] ?? '');

            // Skip workers without a valid name
            if (empty($workerName)) {
                continue;
            }

            $dailyRate = $worker['daily_rate'] ?? null;
            $hasRate = $dailyRate && is_numeric($dailyRate) && (float) $dailyRate > 0;
            $rate = $hasRate ? round((float) $dailyRate, 2) : null;

            $workerRole = $worker['position'] ?? null;

            // Check if worker already exists in the workers table (case-insensitive name match)
            $existingWorker = Worker::query()
                ->whereRaw('LOWER(name) = ?', [strtolower($workerName)])
                ->where('project_id', $projectId)
                ->first();

            if ($existingWorker) {
                // Only update rate if AI detected one — never overwrite existing rate with null
                if ($hasRate && (float) $existingWorker->default_rate_per_hour !== $rate) {
                    $existingWorker->update(['default_rate_per_hour' => $rate]);
                }
            } else {
                // Create new worker — add to Worker Rate Management
                $attributes = [
                    'foreman_id' => $foremanId,
                    'project_id' => $projectId,
                    'name'       => $workerName,
                    'job_type'   => $this->mapPositionToJobType($workerRole),
                ];

                // Only set rate if AI detected one
                if ($hasRate) {
                    $attributes['default_rate_per_hour'] = $rate;
                }

                Worker::create($attributes);
            }
        }
    }

    /**
     * Map an AI-detected position/role to a Worker job type constant.
     */
    protected function mapPositionToJobType(?string $position): string
    {
        $lower = strtolower(trim($position ?? ''));

        if (str_contains($lower, 'skilled')) {
            return Worker::JOB_TYPE_SKILLED_WORKER;
        }
        if (str_contains($lower, 'labor') || str_contains($lower, 'helper')) {
            return Worker::JOB_TYPE_LABORER;
        }

        return Worker::JOB_TYPE_WORKER;
    }

    /**
     * Parse attendance day key like "8/16", "Mon 8/24", "Mon" to a Y-m-d date.
     */
    protected function parseAttendanceDay(string $dayKey, string $year): ?string
    {
        // Strip leading day name like "Mon "
        $clean = preg_replace('/^[A-Za-z]+\s+/', '', trim($dayKey));

        // Match M/D or MM/DD format
        if (preg_match('/^(\d{1,2})\/(\d{1,2})$/', $clean, $m)) {
            $month = str_pad($m[1], 2, '0', STR_PAD_LEFT);
            $day = str_pad($m[2], 2, '0', STR_PAD_LEFT);
            $dateStr = "{$year}-{$month}-{$day}";
            return $this->isValidDate($dateStr) ? $dateStr : null;
        }

        return null;
    }

    /**
     * Check if a string is a valid Y-m-d date.
     */
    protected function isValidDate(string $date): bool
    {
        $d = \DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }

    /**
     * Extract a valid Y-m-d date from flexible formats.
     *
     * Handles:
     *  - "2026-08-26"                    → "2026-08-26"
     *  - "2026-08-26 to 2026-08-27"      → "2026-08-26" (first date)
     *  - "2026-08-26 - 2026-08-27"       → "2026-08-26" (first date)
     *  - "August 26, 2026"               → "2026-08-26"
     *  - "Aug 26 2026"                  → "2026-08-26"
     *  - "08/26/2026" (US slash)        → "2026-08-26"
     *  - "26/08/2026" (Euro slash)      → "2026-08-26"
     *  - "26.08.2026" (dot-separated)   → "2026-08-26"
     *  - "2026/08/26" (Y/M/D slash)     → "2026-08-26"
     *  - "08/26/2026 to 08/27/2026"      → "2026-08-26" (first date)
     *  - "Aug 26 - Aug 27, 2026"        → "2026-08-26" (first date)
     *  - "August 26-27, 2026"           → "2026-08-26" (first date)
     *  - "26th August 2026"             → "2026-08-26" (ordinal stripped)
     *  - "26-Aug-2026"                  → "2026-08-26"
     *  - "08/26" (no year)              → "current-year-08-26"
     */
    protected function parseFlexibleDate(?string $raw): ?string
    {
        if (empty($raw)) {
            return null;
        }

        $raw = trim($raw);

        // 1. Try ISO Y-m-d first (handles ranges like "2026-08-26 to ...")
        if (preg_match('/(\d{4}-\d{2}-\d{2})/', $raw, $m)) {
            return $this->isValidDate($m[1]) ? $m[1] : null;
        }

        // 2. Try Y/M/D slash format ("2026/08/26")
        if (preg_match('/(\d{4})\/(\d{1,2})\/(\d{1,2})/', $raw, $m)) {
            $date = sprintf('%s-%02d-%02d', $m[1], (int) $m[2], (int) $m[3]);
            return $this->isValidDate($date) ? $date : null;
        }

        // 3. Strip ordinal suffixes ("26th" → "26", "2nd" → "2") so strtotime can parse
        $cleaned = preg_replace('/(\d+)(st|nd|rd|th)/i', '$1', $raw);

        // 4. Try strtotime on the cleaned text (handles "August 26, 2026", "Aug 26 2026", etc.)
        $timestamp = strtotime($cleaned);
        if ($timestamp !== false) {
            $date = date('Y-m-d', $timestamp);
            return $this->isValidDate($date) ? $date : null;
        }

        // 5. Handle range strings that strtotime can't parse as a whole.
        //    Split on common range separators and parse each part individually.
        $rangeSeparators = '/\s*(?:to|\-|\—|\–|through|thru|\band\b)\s*/i';
        if (preg_match($rangeSeparators, $raw)) {
            $parts = preg_split($rangeSeparators, $raw, -1, PREG_SPLIT_NO_EMPTY);
            if (!empty($parts)) {
                return $this->parseFlexibleDate(trim($parts[0]));
            }
        }

        // 6. Handle dot-separated dates ("26.08.2026")
        if (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', $raw, $m)) {
            // Could be DD.MM.YYYY (European) or MM.DD.YYYY (US) — try DD first
            $date = sprintf('%s-%02d-%02d', $m[3], (int) $m[2], (int) $m[1]);
            if ($this->isValidDate($date)) {
                return $date;
            }
            // Try MM.DD.YYYY
            $date = sprintf('%s-%02d-%02d', $m[3], (int) $m[1], (int) $m[2]);
            return $this->isValidDate($date) ? $date : null;
        }

        // 7. Handle slash-separated dates without year ("08/26" or "8/26")
        if (preg_match('/^(\d{1,2})\/(\d{1,2})$/', $raw, $m)) {
            $date = sprintf('%s-%02d-%02d', date('Y'), (int) $m[1], (int) $m[2]);
            if ($this->isValidDate($date)) {
                return $date;
            }
            // Try DD/MM (European) with current year
            $date = sprintf('%s-%02d-%02d', date('Y'), (int) $m[2], (int) $m[1]);
            return $this->isValidDate($date) ? $date : null;
        }

        return null;
    }

    /**
     * Create expense records from parsed data.
     *
     * One Expense row is created per AI-detected item so multi-line receipts
     * keep their per-line categories instead of collapsing into the first
     * item's category with the receipt total.
     */
    protected function createExpenseRecord(ProcessedRecord $record, ?array $parsedData): void
    {
        if (!$parsedData) {
            return;
        }

        $date = $this->parseFlexibleDate($parsedData['date'] ?? null) ?? date('Y-m-d');

        $sharedNoteParts = [];
        if (isset($parsedData['receipt_number'])) {
            $sharedNoteParts[] = "Receipt: {$parsedData['receipt_number']}";
        }
        if (isset($parsedData['paid_by'])) {
            $sharedNoteParts[] = "Paid by: {$parsedData['paid_by']}";
        }
        if (isset($parsedData['remarks'])) {
            $sharedNoteParts[] = $parsedData['remarks'];
        }

        $items = $parsedData['items'] ?? [];
        if (!is_array($items)) {
            $items = [];
        }
        $items = array_values(array_filter(
            $items,
            fn ($item) => is_array($item) && (
                trim((string) ($item['description'] ?? '')) !== '' ||
                (float) ($item['amount'] ?? 0) > 0
            )
        ));

        if (empty($items)) {
            Expense::create([
                'project_id' => $record->project_id,
                'category'   => $this->normalizeExpenseCategory($parsedData['items'][0]['category'] ?? null),
                'amount'     => $parsedData['total'] ?? $parsedData['subtotal'] ?? 0,
                'note'       => implode(' | ', $sharedNoteParts),
                'date'       => $date,
            ]);

            return;
        }

        foreach ($items as $item) {
            $amount = (float) ($item['amount']
                ?? ((float) ($item['quantity'] ?? 0) * (float) ($item['unit_price'] ?? 0)));

            $noteParts = [];
            if (trim((string) ($item['description'] ?? '')) !== '') {
                $noteParts[] = $item['description'];
            }
            $noteParts = array_merge($noteParts, $sharedNoteParts);

            Expense::create([
                'project_id' => $record->project_id,
                'category'   => $this->normalizeExpenseCategory($item['category'] ?? null),
                'amount'     => $amount,
                'note'       => implode(' | ', $noteParts),
                'date'       => $date,
            ]);
        }
    }

    /**
     * Per-scope foreman requirement for accomplishment submit.
     *
     * Every detected scope must resolve to a foreman: either selected during
     * Review Records (assigned_personnel in the parsed data) or already stored
     * on the matching build Scope of Works row. Returns Laravel-style field
     * errors keyed by scopes.{index}.assigned_personnel for scopes missing one.
     */
    protected function validateAccomplishmentAssignees(ProcessedRecord $record, ?array $parsedData): array
    {
        $scopes = is_array($parsedData['scopes'] ?? null) ? $parsedData['scopes'] : [];
        if (empty($scopes)) {
            return [];
        }

        // No foremen on the project means no one to assign — the field stays
        // nullable like the build-page form instead of blocking submit forever.
        if (empty($this->projectForemanIds((int) $record->project_id))) {
            return [];
        }

        $projectId = (int) $record->project_id;
        $stored = \App\Models\ProjectScope::query()
            ->where('project_id', $projectId)
            ->get(['scope_name', 'assigned_personnel'])
            ->mapWithKeys(fn ($scope) => [mb_strtolower(trim((string) $scope->scope_name)) => trim((string) ($scope->assigned_personnel ?? ''))])
            ->all();

        $errors = [];
        foreach (array_values($scopes) as $index => $scope) {
            if (!is_array($scope)) {
                continue;
            }

            $scopeName = $this->normalizeScopeName($scope['scope_name'] ?? '');
            if ($scopeName === '') {
                continue;
            }

            $selected = trim((string) ($scope['assigned_personnel'] ?? $scope['assigned'] ?? ''));
            $alreadyStored = $stored[mb_strtolower($scopeName)] ?? '';

            if ($selected === '' && $alreadyStored === '') {
                $errors["scopes.{$index}.assigned_personnel"] = [
                    "Foreman is required for scope \"{$scopeName}\".",
                ];
            }
        }

        return $errors;
    }

    /**
     * Create accomplishment records from parsed scope-of-works data.
     *
     * Mirrors the /build Scope of Works add/update semantics from
     * MonitoringService: same field rules, same status inference, same
     * overall-progress recompute (AVG of progress_percent). Updates the
     * ProjectScope master rows with fuzzy case-insensitive matching
     * (creating missing scopes) and inserts matching WeeklyAccomplishment
     * history rows for the Build scope table.
     *
     * @return array{created:int,updated:int}
     */
    protected function createAccomplishmentRecords(ProcessedRecord $record, ?array $parsedData): array
    {
        $empty = ['created' => 0, 'updated' => 0];
        if (!$parsedData) {
            return $empty;
        }

        $scopes = $parsedData['scopes'] ?? [];
        if (!is_array($scopes) || empty($scopes)) {
            return $empty;
        }

        $projectId = $record->project_id;
        $foremanId = $record->user_id ?? $this->getProjectForemanId($projectId);
        $validAssignees = $this->validAssigneeNames($projectId);

        $weekStart = $this->parseFlexibleDate($parsedData['date'] ?? null)
            ?? $this->parseFlexibleDate($parsedData['week_start'] ?? null)
            ?? \Illuminate\Support\Carbon::now('Asia/Manila')->startOfWeek(\Illuminate\Support\Carbon::MONDAY)->toDateString();

        $maxSortOrder = (int) (\App\Models\ProjectScope::where('project_id', $projectId)->max('sort_order') ?? 0);
        $created = 0;
        $updated = 0;

        foreach ($scopes as $scope) {
            if (!is_array($scope)) {
                continue;
            }

            $scopeName = $this->normalizeScopeName($scope['scope_name'] ?? '');
            if ($scopeName === '' || mb_strlen($scopeName) > 255) {
                continue;
            }

            $contractAmount = $this->parseAmount($scope['contract_amount'] ?? null);
            if ($contractAmount !== null) {
                $contractAmount = max(0, $contractAmount);
            }
            $weightPercent = $this->parsePercent($scope['weight_percent'] ?? $scope['weight'] ?? null);
            if ($weightPercent !== null) {
                $weightPercent = max(0, min(100, $weightPercent));
            }
            $progressPercent = (int) round($this->parsePercent($scope['progress_percent'] ?? $scope['progress'] ?? $scope['percent_completed'] ?? null) ?? 0);
            $progressPercent = max(0, min(100, $progressPercent));

            $status = strtoupper(trim((string) ($scope['status'] ?? '')));
            if (!in_array($status, ['NOT_STARTED', 'IN_PROGRESS', 'HOLD', 'COMPLETED'], true)) {
                $status = \App\Models\ProjectScope::statusFromProgress($progressPercent);
            }

            // Same rule as the build-page Add/Edit form: assigned_personnel must
            // be an exact foreman fullname (no commas/semicolons/pipes) or empty.
            // Never fail the whole submit on a bad guess — drop it to null.
            $assigned = trim((string) ($scope['assigned_personnel'] ?? $scope['assigned'] ?? ''));
            if ($assigned !== '' && (strpbrk($assigned, ',;|') !== false || !$this->isValidAssignee($assigned, $validAssignees))) {
                $assigned = '';
            }
            if (mb_strlen($assigned) > 255) {
                $assigned = '';
            }
            $remarks = mb_substr(trim((string) ($scope['remarks'] ?? '')), 0, 2000);

            $existing = \App\Models\ProjectScope::where('project_id', $projectId)
                ->whereRaw('LOWER(scope_name) = ?', [mb_strtolower($scopeName)])
                ->first();

            $canonicalName = $existing ? (string) $existing->scope_name : $scopeName;

            if ($existing) {
                $updates = [
                    'progress_percent' => $progressPercent,
                    'status' => $status,
                ];
                // Dash/empty in the sheet (null) preserves the stored value,
                // exactly like leaving the build-page field untouched.
                if ($contractAmount !== null) {
                    $updates['contract_amount'] = $contractAmount;
                }
                if ($weightPercent !== null) {
                    $updates['weight_percent'] = $weightPercent;
                }
                if ($assigned !== '') {
                    $updates['assigned_personnel'] = $assigned;
                }
                if ($remarks !== '') {
                    $updates['remarks'] = $remarks;
                }
                $existing->update($updates);
                $updated++;
            } else {
                $maxSortOrder++;
                \App\Models\ProjectScope::create([
                    'project_id' => $projectId,
                    'scope_name' => $scopeName,
                    'assigned_personnel' => $assigned !== '' ? $assigned : null,
                    'progress_percent' => $progressPercent,
                    'status' => $status,
                    'remarks' => $remarks !== '' ? $remarks : null,
                    // New rows need concrete numbers like the Add Scope form
                    // requires, so default missing sheet cells to 0.
                    'contract_amount' => $contractAmount ?? 0,
                    'weight_percent' => $weightPercent ?? 0,
                    'sort_order' => $maxSortOrder,
                ]);
                $created++;
            }

            \App\Models\WeeklyAccomplishment::create([
                'foreman_id' => $foremanId,
                'submitted_by' => $record->user_id,
                'project_id' => $projectId,
                'scope_of_work' => $canonicalName,
                'percent_completed' => $progressPercent,
                'week_start' => $weekStart,
            ]);
        }

        // Same recompute as MonitoringService: overall = AVG(scope progress).
        $average = (float) (\App\Models\ProjectScope::where('project_id', $projectId)->avg('progress_percent') ?? 0);
        $project = Project::query()->find($projectId);
        if ($project) {
            $project->overall_progress = (int) round(max(0, min(100, $average)));
            $project->save();
        }

        return ['created' => $created, 'updated' => $updated];
    }

    /**
     * Foreman user ids assigned to a project — the same union the
     * /projects/{id}/edit Assigned Foremen section uses: ProjectAssignment
     * rows with the foreman role plus users matching the legacy CSV
     * "assigned" field. No fallback: empty means the project has no foremen.
     *
     * @return array<int,int>
     */
    protected function projectForemanIds(int $projectId): array
    {
        $project = Project::query()->find($projectId);

        $assignedIds = \App\Models\ProjectAssignment::query()
            ->where('project_id', $projectId)
            ->where('role_in_project', \App\Models\ProjectAssignment::ROLE_FOREMAN)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        if ($project) {
            $assignedNames = collect(preg_split('/[,;]+/', (string) ($project->assigned ?? '')))
                ->map(fn ($name) => trim((string) $name))
                ->filter(fn (string $name) => $name !== '')
                ->values();

            if ($assignedNames->isNotEmpty()) {
                $nameIds = \App\Models\User::query()
                    ->where('role', \App\Models\User::ROLE_FOREMAN)
                    ->get(['id', 'fullname'])
                    ->filter(fn ($user) => $assignedNames->contains(fn (string $name) => mb_strtolower($name) === mb_strtolower((string) $user->fullname)))
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->values()
                    ->all();

                $assignedIds = array_values(array_unique(array_merge($assignedIds, $nameIds)));
            }
        }

        return $assignedIds;
    }

    /**
     * Valid assignee fullnames for a project (union above, falling back to
     * all foremen when the project has none assigned).
     *
     * @return array<int,string>
     */
    protected function validAssigneeNames(int $projectId): array
    {
        $assignedIds = $this->projectForemanIds($projectId);

        $names = collect();
        if (!empty($assignedIds)) {
            $names = \App\Models\User::query()->whereIn('id', $assignedIds)->pluck('fullname');
        }
        if ($names->isEmpty()) {
            $names = \App\Models\User::query()->where('role', \App\Models\User::ROLE_FOREMAN)->pluck('fullname');
        }

        return $names->map(fn ($name) => trim((string) $name))->filter()->values()->all();
    }

    /**
     * Review-time context for accomplishment records: the project's active
     * foremen (same source as Assigned Foremen on /projects/{id}/edit) plus
     * the current scope assignments from the build Scope of Works table.
     *
     * @return array{foreman_options: array<int,array{id:int,fullname:string}>, scopes: array<int,array{scope_name:string,assigned_personnel:?string}>}
     */
    protected function accomplishmentContextForProject(int $projectId): array
    {
        if ($projectId <= 0) {
            return ['foreman_options' => [], 'scopes' => []];
        }

        $ids = $this->projectForemanIds($projectId);

        $options = [];
        if (!empty($ids)) {
            $options = \App\Models\User::query()
                ->whereIn('id', $ids)
                ->orderBy('fullname')
                ->get(['id', 'fullname'])
                ->map(fn ($user) => ['id' => (int) $user->id, 'fullname' => trim((string) $user->fullname)])
                ->filter(fn (array $row) => $row['fullname'] !== '')
                ->values()
                ->all();
        }

        $scopes = \App\Models\ProjectScope::query()
            ->where('project_id', $projectId)
            ->orderByRaw('sort_order is null')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['scope_name', 'assigned_personnel'])
            ->map(fn ($scope) => [
                'scope_name' => (string) $scope->scope_name,
                'assigned_personnel' => $scope->assigned_personnel !== null ? trim((string) $scope->assigned_personnel) : null,
            ])
            ->values()
            ->all();

        return ['foreman_options' => $options, 'scopes' => $scopes];
    }

    /**
     * Context map for every project involved in an upload batch, keyed by
     * project id string.
     */
    protected function accomplishmentContextMap(iterable $records): array
    {
        $ids = collect($records)
            ->map(fn ($record) => (int) ($record->project_id ?? 0))
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        $map = [];
        foreach ($ids as $id) {
            $map[(string) $id] = $this->accomplishmentContextForProject($id);
        }

        return $map;
    }

    /**
     * Foreman options + current scope assignments for the Review Records
     * accomplishment UI.
     */
    public function accomplishmentContext(Project $project): JsonResponse
    {
        return response()->json($this->accomplishmentContextForProject((int) $project->id));
    }

    protected function isValidAssignee(string $name, array $validNames): bool
    {
        return in_array($name, $validNames, true);
    }

    /**
     * Second AI pass (text-only, accomplishment only): now that the project is
     * known, ask the model to resolve each detected scope name against that
     * project's Scope of Works — tolerating typos, abbreviations, casing and
     * expanded short forms. Only substitutes names that exist in the stored
     * list (matched case-insensitively). Never throws: on any failure the
     * scopes are returned unchanged and the deterministic
     * canonicalizeScopeNames() fallback still applies.
     *
     * @param array<int,mixed> $scopes
     * @return array<int,mixed>
     */
    protected function aiResolveScopeNames(array $scopes, int $projectId, string $model): array
    {
        try {
            $stored = \App\Models\ProjectScope::query()
                ->where('project_id', $projectId)
                ->orderBy('id')
                ->pluck('scope_name')
                ->map(fn ($name) => trim((string) $name))
                ->filter()
                ->values()
                ->all();
            if (empty($stored)) {
                return $scopes;
            }

            $detected = [];
            foreach ($scopes as $index => $scope) {
                $name = trim((string) (is_array($scope) ? ($scope['scope_name'] ?? '') : ''));
                if ($name !== '') {
                    $detected[$index] = $name;
                }
            }
            if (empty($detected)) {
                return $scopes;
            }

            $canonicalLines = [];
            foreach ($stored as $name) {
                $canonicalLines[] = '- '.$name;
            }
            $detectedLines = [];
            foreach ($detected as $index => $name) {
                $detectedLines[] = $index.': '.$name;
            }

            $prompt = "You are matching scope-of-works names from a construction sheet to a project's canonical Scope of Works list.\n\n"
                ."CANONICAL SCOPES:\n".implode("\n", $canonicalLines)."\n\n"
                ."DETECTED FROM IMAGE:\n".implode("\n", $detectedLines)."\n\n"
                ."Return JSON only, no other text: {\"matches\": [{\"index\": 0, \"canonical_name\": \"Exact Name\" or null}]}.\n"
                ."Rules: compare case-insensitively; tolerate typos, abbreviations and expanded short forms; canonical_name must be copied EXACTLY from the canonical list or null when nothing is related in meaning.";

            $response = $this->openRouter->chatText($model, $prompt);
            if (isset($response['error']) && $response['error']) {
                return $scopes;
            }
            $content = OpenRouterService::extractContent($response);
            if (!$content) {
                return $scopes;
            }
            $content = trim(preg_replace('/^```(?:json)?|```$/', '', trim($content)) ?? '');
            $decoded = json_decode($content, true);
            if (!is_array($decoded)) {
                return $scopes;
            }

            $matches = $decoded['matches'] ?? $decoded;
            if (!is_array($matches)) {
                return $scopes;
            }

            $byLower = [];
            foreach ($stored as $name) {
                $byLower[mb_strtolower($name)] = $name;
            }
            foreach ($matches as $key => $match) {
                if (is_array($match)) {
                    $index = $match['index'] ?? null;
                    $canonical = trim((string) ($match['canonical_name'] ?? ''));
                } else {
                    $index = $key;
                    $canonical = trim((string) $match);
                }
                if ((!is_int($index) && !ctype_digit((string) $index)) || $canonical === '') {
                    continue;
                }
                $index = (int) $index;
                if (!isset($scopes[$index]) || !is_array($scopes[$index])) {
                    continue;
                }
                // Only accept names that really exist in the stored list.
                if (isset($byLower[mb_strtolower($canonical)])) {
                    $scopes[$index]['scope_name'] = $byLower[mb_strtolower($canonical)];
                }
            }
        } catch (\Throwable $e) {
            Log::warning('AI scope-name refinement failed, keeping detected names', ['exception' => $e->getMessage()]);
        }

        return $scopes;
    }

    /**
     * Relatedness score (0-100) between two scope names after normalization.
     * Combines character similarity (typos like "within" vs "with") with
     * word-token similarity (reordered or partially rewritten names) and
     * takes the stronger signal.
     */
    protected function scopeNameSimilarity(string $a, string $b): float
    {
        $a = mb_strtolower($this->normalizeScopeName($a));
        $b = mb_strtolower($this->normalizeScopeName($b));
        if ($a === '' || $b === '') {
            return 0.0;
        }
        if ($a === $b) {
            return 100.0;
        }

        similar_text($a, $b, $charPercent);

        $tokensA = array_values(array_unique(preg_split('/[^a-z0-9]+/', $a, -1, PREG_SPLIT_NO_EMPTY) ?: []));
        $tokensB = array_values(array_unique(preg_split('/[^a-z0-9]+/', $b, -1, PREG_SPLIT_NO_EMPTY) ?: []));
        $tokenScore = 0.0;
        if (!empty($tokensA) && !empty($tokensB)) {
            $shared = count(array_intersect($tokensA, $tokensB));
            $tokenScore = 200 * $shared / (count($tokensA) + count($tokensB));
        }

        return max((float) $charPercent, $tokenScore);
    }

    /**
     * Rewrite AI-detected scope names to the stored canonical form
     * ("floor" → "Floor") so review, assignee lookup, submit and weekly
     * history all treat them as the same scope. Falls back to a relatedness
     * check for AI rewrites and typos the exact match misses (e.g. an
     * expanded abbreviation like "2nd Floor" for stored "2ndF", or "within"
     * for stored "with"). Names with no close match are left untouched.
     *
     * @param array<int,mixed> $scopes
     * @return array<int,mixed>
     */
    protected function canonicalizeScopeNames(int $projectId, array $scopes): array
    {
        if ($projectId <= 0 || empty($scopes)) {
            return $scopes;
        }

        $stored = \App\Models\ProjectScope::query()
            ->where('project_id', $projectId)
            ->pluck('scope_name')
            ->mapWithKeys(fn ($name) => [mb_strtolower($this->normalizeScopeName($name)) => (string) $name])
            ->all();

        foreach ($scopes as $index => $scope) {
            if (!is_array($scope)) {
                continue;
            }
            $key = mb_strtolower($this->normalizeScopeName($scope['scope_name'] ?? ''));
            if ($key === '') {
                continue;
            }
            if (isset($stored[$key])) {
                $scopes[$index]['scope_name'] = $stored[$key];
                continue;
            }
            $bestName = null;
            $bestScore = 0.0;
            foreach ($stored as $storedName) {
                $score = $this->scopeNameSimilarity($key, (string) $storedName);
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestName = $storedName;
                }
            }
            if ($bestName !== null && $bestScore >= 80) {
                $scopes[$index]['scope_name'] = $bestName;
            }
        }

        return $scopes;
    }

    /**
     * Strip AI image-readability commentary from scope remarks (e.g.
     * "Progress column is not visible in the image") so it never lands in
     * the Scope of Works table. Genuine work notes are kept: offending
     * sentences are removed, and an all-complaint value becomes empty.
     */
    protected function sanitizeAiRemarks(mixed $value): string
    {
        $text = trim((string) $value);
        if ($text === '') {
            return '';
        }

        $sentences = preg_split('/(?<=[.!?])\s+|\r?\n/', $text) ?: [$text];
        $kept = [];
        foreach ($sentences as $sentence) {
            $sentence = trim($sentence);
            if ($sentence === '' || $this->isImageCommentary($sentence)) {
                continue;
            }
            $kept[] = $sentence;
        }

        return trim(implode(' ', $kept));
    }

    /**
     * Whether a remarks sentence complains about the source image/columns
     * instead of describing the work.
     */
    protected function isImageCommentary(string $sentence): bool
    {
        if (preg_match('/\bnot visible in the (image|photo|picture|document|sheet|scan)\b/i', $sentence)) {
            return true;
        }

        $hasComplaint = (bool) preg_match('/\b(can\'t|cannot|could not|couldn\'t|unable to|illegible|unreadable|not shown|not provided|not available|not included|not clear|unclear|blurry)\b/i', $sentence);
        $mentionsSource = (bool) preg_match('/\b(image|photo|picture|sheet|document|scan|column|cell)\b/i', $sentence);

        return $hasComplaint && $mentionsSource;
    }

    /**
     * Normalize an AI-detected scope name (strip "1. " numbering, collapse spaces).
     */
    protected function normalizeScopeName(mixed $value): string
    {
        $name = trim((string) $value);
        $name = preg_replace('/^\d+\s*[.\)\-]\s*/', '', $name) ?? $name;

        return trim(preg_replace('/\s+/', ' ', $name) ?? $name);
    }

    /**
     * Parse a currency-ish value (handles "P 90,000.00", "-", null).
     */
    protected function parseAmount(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_numeric($value)) {
            return round((float) $value, 2);
        }
        $text = trim((string) $value);
        if ($text === '' || $text === '-') {
            return null;
        }
        $cleaned = preg_replace('/[^0-9.\-]/', '', $text) ?? '';
        if ($cleaned === '' || $cleaned === '-' || $cleaned === '.') {
            return null;
        }

        return round((float) $cleaned, 2);
    }

    /**
     * Parse a percent-ish value (handles "3.76%", "-", null).
     */
    protected function parsePercent(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_numeric($value)) {
            return round((float) $value, 2);
        }
        $text = trim((string) $value);
        if ($text === '' || $text === '-') {
            return null;
        }
        $cleaned = preg_replace('/[^0-9.\-]/', '', $text) ?? '';
        if ($cleaned === '' || $cleaned === '-' || $cleaned === '.') {
            return null;
        }

        return round((float) $cleaned, 2);
    }

    /**
     * Map an AI-detected category onto the canonical default categories.
     */
    protected function normalizeExpenseCategory(mixed $category): string
    {
        $value = trim((string) $category);

        foreach (Expense::defaultCategories() as $canonical) {
            if (strcasecmp($value, $canonical) === 0) {
                return $canonical;
            }
        }

        if (strcasecmp($value, 'other') === 0) {
            return 'Others';
        }

        return 'Others';
    }

    /**
     * Build per-project scope grounding so the AI copies canonical scope names
     * exactly as they appear on the /projects/{id}/build Scope of Works table.
     */
    protected function buildScopeContext(mixed $storageProjectId): string
    {
        $projectId = (int) ($storageProjectId ?? 0);
        if ($projectId <= 0) {
            return '';
        }

        $project = Project::query()->find($projectId);
        if (!$project) {
            return '';
        }

        $scopes = \App\Models\ProjectScope::query()
            ->where('project_id', $projectId)
            ->orderByRaw('sort_order is null')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['scope_name', 'contract_amount', 'weight_percent', 'progress_percent', 'status', 'assigned_personnel']);

        if ($scopes->isEmpty()) {
            $scopes = collect(\App\Models\WeeklyAccomplishment::defaultScopeOfWorks())
                ->map(fn ($name) => (object) ['scope_name' => $name, 'contract_amount' => null, 'weight_percent' => null, 'progress_percent' => null, 'status' => null, 'assigned_personnel' => null]);
        }

        $lines = $scopes->map(function ($scope) {
            $name = trim((string) ($scope->scope_name ?? ''));
            if ($name === '') {
                return null;
            }
            $detail = "Scope: {$name}";
            if ($scope->contract_amount !== null && (float) $scope->contract_amount > 0) {
                $detail .= ' | Contract: '.number_format((float) $scope->contract_amount, 2, '.', '');
            }
            if ($scope->weight_percent !== null && (float) $scope->weight_percent > 0) {
                $detail .= ' | Weight: '.number_format((float) $scope->weight_percent, 2, '.', '').'%';
            }
            if ($scope->progress_percent !== null) {
                $detail .= ' | Progress: '.((int) $scope->progress_percent).'%';
            }

            return '- '.$detail;
        })->filter()->values()->implode("\n");

        // Project foremen only (no all-foremen fallback): when the project has
        // none assigned, the section is omitted and the AI leaves assignees empty.
        $foremanIds = $this->projectForemanIds($projectId);
        $foremanLines = '';
        if (!empty($foremanIds)) {
            $foremanLines = \App\Models\User::query()
                ->whereIn('id', $foremanIds)
                ->orderBy('fullname')
                ->pluck('fullname')
                ->map(fn ($name) => trim((string) $name))
                ->filter()
                ->values()
                ->map(fn ($name) => '- '.$name)
                ->implode("\n");
        }

        $section = "\n\nCANONICAL SCOPE LIST FOR PROJECT ID {$projectId} ({$project->name}):\n{$lines}\n";
        $section .= "Copy scope_name EXACTLY as written above (same words, same casing). Strip only the leading row number from the image (e.g. image shows 12. ROOF BEAM → output ROOF BEAM only if that is the canonical form, else output the canonical Roof Beam).\n";
        $section .= "Transcribe each image row character-for-character before matching: never expand abbreviations or 'correct' the text (image \"2ndF\" stays \"2ndF\", never \"2nd Floor\"). Match that transcription against the list above and output the canonical name.\n";
        $section .= "If an image row has no close match in this list, keep the cleaned image text as scope_name so it can be created as a new scope.\n";
        if ($foremanLines !== '') {
            $section .= "\nVALID ASSIGNED PERSONNEL (copy exactly or leave empty):\n{$foremanLines}\n";
            $section .= "Never invent a foreman name. If the sheet shows no assignee, leave assigned_personnel empty.\n";
        }

        return $section;
    }

    /**
     * Build the user prompt with project list and project-specific categories.
     */
    protected function buildUserPrompt(string $existingProjects, ?string $notes = null, string $mode = 'general', array $projectCategories = [], string $scopeContext = ''): string
    {
        $notesSection = '';
        if ($notes && trim($notes) !== '') {
            $notesSection = "\n\nUSER NOTES: " . trim($notes) . "\n";
        }

        $modeSection = '';
        if ($mode === 'attendance') {
            $modeSection = "

═══════════════════════════════════════════════════════════
⚠️  ATTENDANCE MODE — ONLY ATTENDANCE RECORDS WANTED
═══════════════════════════════════════════════════════════
You are processing images for DAILY ATTENDANCE ONLY.
- ONLY extract attendance records (worker names, rates, attendance marks, hours).
- Do NOT extract expense records, receipts, or any non-attendance data.
- If the image contains expenses or unrelated content, still extract the attendance portion and mark non-attendance parts as irrelevant.
- For each worker, include their daily_rate if visible in the image.
";
        }

        return "Analyze the attached images of construction records.

EXISTING PROJECTS IN THE SYSTEM:
{$existingProjects}{$notesSection}{$scopeContext}{$modeSection}
═══════════════════════════════════════════════════════════
MANDATORY ANALYSIS PROCESS — FOLLOW THIS ORDER:
═══════════════════════════════════════════════════════════

STEP 1 — OVERVIEW: What type of document? What is the layout? What language?
STEP 2 — STRUCTURE: Identify all column headers, row labels, form fields.
STEP 3 — EXTRACTION: Read row by row, column by column. Follow each row across ALL columns before moving to the next row.
STEP 4 — VALIDATION: Cross-check totals. Verify counts. Ensure mathematical consistency.

═══════════════════════════════════════════════════════════

For EACH distinct record found in the images, determine:
1. Record type (attendance, expense, or accomplishment for scope-of-works sheets with SCOPE/CONTRACT AMOUNT/WT % columns)
2. Project (match from the list above by ID, name, or context)
3. Extract ALL structured data

IMPORTANT: For attendance records:
- SINGLE-DAY attendance (time in/out per worker): use date field.
- WEEKLY attendance sheet (grid with P/A/L/H marks per day): use attendance map with date_range_start and date_range_end.
- P = Present (8 hrs), A = Absent (0 hrs), L = Late (8 hrs), H = Half Day (4 hrs)
- For weekly sheets, set date_range_start and date_range_end from the form header.
- For weekly sheets, each worker needs an attendance map like {8/16: P, 8/17: A} and days_present count.
- For handwritten checkmarks (✓) or X marks: count them to determine days present/absent.
- CRITICAL: Detect the daily_rate (pay/salary) for each worker. Rates may appear in various formats: a labeled column (Rate, Salary, Daily Rate, Pay, etc.), numbers next to worker names, or inferred from total amounts divided by days worked. Always include the detected rate as 'daily_rate' in each worker's data. This rate will automatically update the Worker Rate Management system.

HANDWRITTEN DOCUMENTS — EXTRA CARE:
- Distinguish between similar characters: O vs 0, I vs 1, S vs 5, 6 vs 8, l vs 1
- Use context clues: if a name appears multiple times, use the most legible spelling
- For amounts: verify math (rate × days = total)
- If unsure about a character, note it in the SUMMARY field

IMPORTANT: For accomplishment sheets (SCOPE OF WORKS AND MATERIALS tables — same shape as the /projects/build Scope of Works table):
- The sheet columns map to the build table as: SCOPE OF WORKS AND MATERIALS → scope_name, CONTRACT AMOUNT → contract_amount, WT % → weight_percent, % AC / % ACCOMP → progress_percent. The build page then computes WT % contribution = weight x progress / 100 and Accomp Amount = contract x progress / 100, so extract the raw sheet values, never the computed ones.
- One RECORD per image with TYPE accomplishment and STRUCTURED_DATA holding date plus a scopes array.
- Each scope needs scope_name (strip leading numbering like 1. ), contract_amount, weight_percent, progress_percent, status, assigned_personnel, remarks.
- remarks must describe the work itself (progress, condition, next steps) — never comment on the image, photo, columns or readability (no 'X column is not visible in the image'); leave remarks empty when there is nothing to note about the work.
- Skip TOTAL and LESS footer rows (e.g. the 2,390,996.26 / 100.00% totals line) — they are not scopes.
- A dash (-) or empty cell means null: do not output 0, do not copy the value from another column.
- When a CANONICAL SCOPE LIST is provided above, you must resolve every image row to it yourself: compare case-insensitively and tolerate typos, abbreviations, and expanded short forms (image 'floor' → canonical 'Floor'; image '2nd Floor' → canonical '2ndF'; image 'Catch Basin (within Inside Plastering)' → canonical 'Catch Basin (with Inside Plastering)'). Always output the canonical scope_name exactly, never the image variant; only emit a new name when no list entry is related in meaning.
- assigned_personnel must be copied from VALID ASSIGNED PERSONNEL or left empty; status must be NOT_STARTED, IN_PROGRESS, HOLD, or COMPLETED (infer from progress when the sheet has no status column: 100 → COMPLETED, 0 → NOT_STARTED, otherwise IN_PROGRESS).

Return your response in this EXACT format for each record (separated by ---):

RECORD_N:
TYPE: attendance|expense|accomplishment|irrelevant
PROJECT: project title from image
PROJECT_CODE: project code if visible
PROJECT_ID: matching ID from the list above (or 0 if no match)
CONFIDENCE: high|medium|low
STRUCTURED_DATA: {json here}
SUMMARY: {brief summary}
IRRELEVANT_REASON: {only if TYPE is irrelevant}
---

If only one record is found, only return RECORD_1 block.";
    }

    /**
     * Parse the multi-record AI response.
     */
    protected function parseMultiRecordResponse(?string $content): array
    {
        if (!$content) {
            return [];
        }

        $results = [];
        $blocks = preg_split('/---\s*/', $content);

        foreach ($blocks as $block) {
            $block = trim($block);
            if (empty($block)) continue;

            $result = [
                'type'        => 'unknown',
                'project'     => null,
                'project_id'  => null,
                'confidence'  => 'low',
                'data'        => null,
                'summary'     => null,
                'raw_text'    => $block,
            ];

            // Extract TYPE
            if (preg_match('/TYPE:\s*(attendance|expense|accomplishment|irrelevant)/i', $block, $m)) {
                $result['type'] = strtolower($m[1]);
            }

            // Extract PROJECT
            if (preg_match('/PROJECT:\s*(.+?)(?:\n|$)/i', $block, $m)) {
                $result['project'] = trim($m[1]);
            }

            // Extract PROJECT_ID
            if (preg_match('/PROJECT_ID:\s*(\d+)/i', $block, $m)) {
                $result['project_id'] = (int) $m[1];
            }

            // Extract PROJECT_CODE
            if (preg_match('/PROJECT_CODE:\s*(.+?)(?:\n|$)/i', $block, $m)) {
                $result['project_code'] = trim($m[1]);
            }

            // Extract CONFIDENCE
            if (preg_match('/CONFIDENCE:\s*(high|medium|low)/i', $block, $m)) {
                $result['confidence'] = strtolower($m[1]);
            }

            // Extract STRUCTURED_DATA — find the full JSON block by tracking brace depth
            if (preg_match('/STRUCTURED_DATA:\s*\{/', $block, $m, PREG_OFFSET_CAPTURE)) {
                $jsonStart = $m[0][1] + strlen($m[0][0]) - 1; // position of opening {
                $jsonStr = $this->extractJsonFromText($block, $jsonStart);
                if ($jsonStr) {
                    $data = json_decode($jsonStr, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $result['data'] = $data;
                    }
                }
            }

            // Extract SUMMARY
            if (preg_match('/SUMMARY:\s*(.+?)$/is', $block, $m)) {
                $result['summary'] = trim($m[1]);
            }

            // Extract IRRELEVANT_REASON
            if (preg_match('/IRRELEVANT_REASON:\s*(.+?)$/is', $block, $m)) {
                $result['irrelevant_reason'] = trim($m[1]);
            }

            $results[] = $result;
        }

        return $results;
    }

    /**
     * Resolve a project ID from AI suggestion.
     */
    protected function resolveProjectId(?string $aiSuggestion, ?int $defaultProjectId): ?int
    {
        if (empty($aiSuggestion)) {
            return $defaultProjectId;
        }

        // Try exact match by name
        $project = Project::where('name', $aiSuggestion)->first();
        if ($project) {
            return $project->id;
        }

        // Try partial match
        $project = Project::where('name', 'like', "%{$aiSuggestion}%")->first();
        if ($project) {
            return $project->id;
        }

        // Try matching by client name
        $project = Project::where('client', 'like', "%{$aiSuggestion}%")->first();
        if ($project) {
            return $project->id;
        }

        return $defaultProjectId;
    }

    /**
     * Build a summary of the batch processing.
     */
    protected function buildBatchSummary($records): array
    {
        $collection = collect($records);

        return [
            'total'          => $collection->count(),
            'attendance'     => $collection->where('record_type', 'attendance')->count(),
            'expense'        => $collection->where('record_type', 'expense')->count(),
            'accomplishment' => $collection->where('record_type', 'accomplishment')->count(),
            'pending'        => $collection->where('status', 'pending')->count(),
            'pending_project' => $collection->where('status', 'pending_project')->count(),
        ];
    }

    /**
     * Extract a balanced JSON object from text starting at a given position.
     */
    protected function extractJsonFromText(string $text, int $start): ?string
    {
        $depth = 0;
        $inString = false;
        $escape = false;
        $len = strlen($text);

        for ($i = $start; $i < $len; $i++) {
            $char = $text[$i];

            if ($escape) {
                $escape = false;
                continue;
            }

            if ($char === '\\' && $inString) {
                $escape = true;
                continue;
            }

            if ($char === '"' && !$escape) {
                $inString = !$inString;
                continue;
            }

            if ($inString) continue;

            if ($char === '{') {
                $depth++;
            } elseif ($char === '}') {
                $depth--;
                if ($depth === 0) {
                    return substr($text, $start, $i - $start + 1);
                }
            }
        }

        return null;
    }

    /**
     * Get user-friendly error message.
     */
    protected function getUserFriendlyError(string $message): string
    {
        if (str_contains($message, 'API key')) {
            return 'AI service not configured. Please contact administrator.';
        }

        if (str_contains($message, 'rate') || str_contains($message, 'limit') || str_contains($message, '429')) {
            return 'AI service rate limit reached. Please wait a few minutes and try again, or add credits at openrouter.ai/credits to increase your limit.';
        }

        if (str_contains($message, 'timeout') || str_contains($message, 'timed out')) {
            return 'AI service took too long. Please try again with fewer images.';
        }

        if (str_contains($message, '500') || str_contains($message, '502')) {
            return 'AI service temporarily unavailable. Please try again later.';
        }

        return 'AI processing failed: ' . $message;
    }
}
