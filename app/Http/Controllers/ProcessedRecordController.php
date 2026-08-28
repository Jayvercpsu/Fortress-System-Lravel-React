<?php

namespace App\Http\Controllers;

use App\Models\ProcessedRecord;
use App\Models\Project;
use App\Models\Attendance;
use App\Models\Expense;
use App\Services\OpenRouterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessedRecordController extends Controller
{
    public function __construct(
        protected OpenRouterService $openRouter
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
            'images'   => 'required|array|min:1|max:5',
            'images.*' => 'required|image|max:10240',
            'notes'    => 'nullable|string|max:500',
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
        $storageProjectId = $project?->id;

        // Allow more time for AI processing of multiple images (5 images can be slow)
        set_time_limit(300);

        // 0. Clean up old stale pending/rejected records from previous uploads
        // This ensures only the current batch is included in confirm/submit
        ProcessedRecord::whereIn('status', ['pending', 'pending_project'])
            ->where('user_id', $user->id)
            ->each(fn($oldRecord) => $oldRecord->delete());

        // 1. Get all existing projects for AI to match against (only active projects)
        $existingProjects = Project::select('id', 'name', 'client', 'phase', 'status')
            ->whereIn('status', ['active', 'in_progress', null])
            ->get()
            ->map(fn($p) => "ID: {$p->id} | {$p->name} | Client: {$p->client} | Phase: {$p->phase}")
            ->implode("\n");

        $systemPrompt = OpenRouterService::getSystemPrompt();
        $prompt = $this->buildUserPrompt($existingProjects, $request->notes);

        // 2. Prepare all images for AI processing (NOT saved to disk)
        $imagePayloads = [];

        foreach ($images as $file) {
            $imagePayloads[] = [
                'base64' => base64_encode(file_get_contents($file->getRealPath())),
                'mime'   => $file->getMimeType(),
            ];
        }

        // 3. Call OpenRouter with system prompt (with retry on rate limit)
        $model = config('services.openrouter.model', 'openrouter/free');
        $response = $this->openRouter->chat($model, $prompt, $imagePayloads, $systemPrompt);

        // Retry once on 429 rate limit
        if (isset($response['status']) && $response['status'] == 429) {
            sleep(5);
            $response = $this->openRouter->chat($model, $prompt, $imagePayloads, $systemPrompt);
        }

        // 4. Check for API error
        if (isset($response['error']) && $response['error']) {
            return response()->json([
                'error' => true,
                'message' => $this->getUserFriendlyError($response['message'] ?? 'AI processing failed'),
                'saved' => 0,
                'failed' => count($images),
            ], 422);
        }

        // 5. Parse response
        $content = OpenRouterService::extractContent($response);

        if (empty($content)) {
            return response()->json([
                'error' => true,
                'message' => 'AI returned an empty response. Please try again with clearer images.',
                'saved' => 0,
                'failed' => count($images),
            ], 422);
        }

        $parsedResults = $this->parseMultiRecordResponse($content);

        if (empty($parsedResults)) {
            return response()->json([
                'error' => true,
                'message' => 'AI response could not be parsed. Please try again.',
                'saved' => 0,
                'failed' => count($images),
            ], 422);
        }

        // 6. Separate relevant from irrelevant
        $relevantResults = array_filter($parsedResults, fn($r) => $r['type'] !== 'irrelevant');
        $irrelevantResults = array_filter($parsedResults, fn($r) => $r['type'] === 'irrelevant');

        // If ALL images are irrelevant — nothing to save
        if (empty($relevantResults)) {
            return response()->json([
                'message' => 'No construction records found in the uploaded images.',
                'records' => [],
                'skipped' => count($irrelevantResults),
                'saved' => 0,
            ]);
        }

        // 7. Save ALL relevant records (staging — pending confirmation)
        $records = [];

        foreach ($parsedResults as $index => $imageResult) {
            // Skip irrelevant
            if (!$imageResult || $imageResult['type'] === 'irrelevant') {
                continue;
            }

            $suggestedProjectId = $this->resolveProjectId($imageResult['project'] ?? null, $storageProjectId);

            $records[] = ProcessedRecord::create([
                'project_id'     => $suggestedProjectId,
                'user_id'        => $user->id,
                'record_type'    => $imageResult['type'],
                'image_index'    => $index,
                'ocr_raw_text'   => $imageResult['raw_text'] ?? $content,
                'ai_parsed_data' => $imageResult['data'] ?? null,
                'ai_summary'     => $imageResult['summary'] ?? $content,
                'ai_model'       => $model,
                'status'         => $suggestedProjectId ? 'pending' : 'pending_project',
                'notes'          => $request->notes,
            ])->load(['user:id,fullname', 'project:id,name']);
        }

        return response()->json([
            'records' => $records,
            'skipped' => count($irrelevantResults),
            'saved' => count($records),
            'summary' => $this->buildBatchSummary($records),
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
            } elseif ($record->record_type === 'expense') {
                $this->createExpenseRecord($record, $parsedData);
            }

            $record->update(['status' => 'submitted']);
            $record->load(['user:id,fullname', 'project:id,name']);

            DB::commit();

            return response()->json([
                'record' => $record,
                'message' => 'Record submitted and saved to project',
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
        ]);
    }

    /**
     * Reject a record.
     */
    public function reject(ProcessedRecord $record): JsonResponse
    {
        $record->update(['status' => 'rejected']);

        return response()->json([
            'record' => $record->fresh()->load(['user:id,fullname', 'project:id,name']),
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

        foreach ($parsedData['workers'] as $worker) {
            $workerName = $worker['name'] ?? 'Unknown';
            $workerRole = $worker['position'] ?? 'Laborer';

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
                }
                continue;
            }

            // Format 2: Single-day — {"date": "2026-08-24", "hours": 9.5}
            // Also handles date ranges like "2026-08-26 to 2026-08-27" — uses first date
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
     * Create expense record from parsed data.
     */
    protected function createExpenseRecord(ProcessedRecord $record, ?array $parsedData): void
    {
        if (!$parsedData) {
            return;
        }

        $noteParts = [];
        if (isset($parsedData['items'])) {
            $noteParts[] = collect($parsedData['items'])->pluck('description')->implode(', ');
        }
        if (isset($parsedData['receipt_number'])) {
            $noteParts[] = "Receipt: {$parsedData['receipt_number']}";
        }
        if (isset($parsedData['paid_by'])) {
            $noteParts[] = "Paid by: {$parsedData['paid_by']}";
        }
        if (isset($parsedData['remarks'])) {
            $noteParts[] = $parsedData['remarks'];
        }

        Expense::create([
            'project_id' => $record->project_id,
            'category'   => $parsedData['items'][0]['category'] ?? 'Other',
            'amount'     => $parsedData['total'] ?? $parsedData['subtotal'] ?? 0,
            'note'       => implode(' | ', $noteParts),
            'date'       => $this->parseFlexibleDate($parsedData['date'] ?? null) ?? date('Y-m-d'),
        ]);
    }

    /**
     * Build the user prompt with project list.
     */
    protected function buildUserPrompt(string $existingProjects, ?string $notes = null): string
    {
        $notesSection = '';
        if ($notes && trim($notes) !== '') {
            $notesSection = "\n\nUSER NOTES: " . trim($notes) . "\n";
        }

        return "Analyze the attached images of construction records.

EXISTING PROJECTS IN THE SYSTEM:
{$existingProjects}{$notesSection}
For EACH distinct record found in the images, determine:
1. Record type (attendance or expense)
2. Project (match from the list above by ID, name, or context)
3. Extract ALL structured data

IMPORTANT: For attendance records:
- SINGLE-DAY attendance (time in/out per worker): use date field.
- WEEKLY attendance sheet (grid with P/A/L/H marks per day): use attendance map with date_range_start and date_range_end.
- P = Present (8 hrs), A = Absent (0 hrs), L = Late (8 hrs), H = Half Day (4 hrs)
- For weekly sheets, set date_range_start and date_range_end from the form header.
- For weekly sheets, each worker needs an attendance map like {8/16: P, 8/17: A} and days_present count.

Return your response in this EXACT format for each record (separated by ---):

RECORD_N:
TYPE: attendance|expense|irrelevant
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
            if (preg_match('/TYPE:\s*(attendance|expense|irrelevant)/i', $block, $m)) {
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
