<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenRouterService
{
    protected ?string $apiKey;
    protected string $baseUrl;

    public function __construct()
    {
        $this->apiKey = config('services.openrouter.key');
        $this->baseUrl = config('services.openrouter.url', 'https://openrouter.ai/api/v1');
    }

    /**
     * Send a chat completion request with one or more images (multimodal).
     *
     * @param string $model  OpenRouter model ID (e.g. 'google/gemma-3-27b-it:free')
     * @param string $prompt Text prompt
     * @param array  $images Array of ['base64' => string, 'mime' => string]
     * @param string $systemPrompt Optional system prompt for AI behavior
     * @return array  Raw API response decoded from JSON
     */
    public function chat(
        string $model,
        string $prompt,
        array $images = [],
        ?string $systemPrompt = null
    ): array {
        $messages = [];

        // System prompt (sets AI behavior and rules)
        if ($systemPrompt) {
            $messages[] = [
                'role' => 'system',
                'content' => $systemPrompt,
            ];
        }

        // User message with text + images
        $userContent = [
            ['type' => 'text', 'text' => $prompt],
        ];

        foreach ($images as $image) {
            $userContent[] = [
                'type' => 'image_url',
                'image_url' => [
                    'url' => "data:{$image['mime']};base64,{$image['base64']}",
                ],
            ];
        }

        $messages[] = [
            'role' => 'user',
            'content' => $userContent,
        ];

        return $this->request($model, $messages);
    }

    /**
     * Send a simple text-only chat completion.
     */
    public function chatText(string $model, string $prompt): array
    {
        return $this->chat($model, $prompt);
    }

    /**
     * Get the system prompt for construction record detection.
     *
     * @param array|null $categories Project-specific expense categories. If null, defaults are used.
     */
    public static function getSystemPrompt(?array $categories = null): string
    {
        $categoryValues = $categories ? implode('/', $categories) : 'Materials/Transport/Food/Labor/Other';

        $prompt = <<<'PROMPT'
You are a construction project record assistant. Your job is to carefully analyze images of attendance notes and expense receipts from construction sites.

CATEGORY GUIDELINE:
When classifying expense items, you MUST use only the following categories:
__CATEGORY_VALUES__
Do NOT invent or use categories outside this list. If an expense does not fit any of these categories, classify it under the closest matching category from the list above.

══════════════════════════════════════════════════════════
MANDATORY ANALYSIS PROCESS — FOLLOW THIS ORDER:
══════════════════════════════════════════════════════════

BEFORE extracting any data, you MUST complete this analysis:

STEP 1 — OVERVIEW:
- What type of document is this? (attendance sheet, expense receipt, ledger, etc.)
- What is the overall layout? (table/grid, list, form, handwritten notes, printed text)
- What language is the text in?
- Is it handwritten, printed, or mixed?

STEP 2 — STRUCTURE IDENTIFICATION:
- Identify all column headers and row labels in tables/grids
- Identify all form fields and their labels
- Map out the relationship between columns and rows
- Note any sections (header, body, footer, totals area)

STEP 3 — CONTENT EXTRACTION (row by row, column by column):
- Read each row carefully from left to right
- For tables: follow each row across ALL columns before moving to the next row
- For handwritten text: look at stroke patterns, context clues, and surrounding text
- For numbers: check if they make mathematical sense (e.g., does 800 × 6 = 4800?)
- For attendance sheets: detect the daily rate/pay for each worker. Rates may appear as: a labeled column (Rate, Salary, Daily Rate, Pay), numbers adjacent to worker names, or values that can be inferred from totals divided by days worked. Include the detected rate as 'daily_rate' in each worker's data.

STEP 4 — VALIDATION:
- Cross-check totals: sum of individual amounts should equal displayed total
- Verify worker counts match the number of rows
- Check that attendance marks (✓, X, P, A) are consistent with hours/amounts
- Ensure dates are valid and in the expected range
- Look for any data you may have missed in corners, margins, or margins

══════════════════════════════════════════════════════════

RULES:
1. Analyze each image carefully and determine if it is an attendance record or expense receipt.
2. There may be MULTIPLE records in a single image — detect ALL of them.
3. Extract project title and project code from the image.
4. Extract ALL structured data from the image — names, dates, amounts, hours, items, quantities. Be thorough and do not skip any visible data.
5. If the image is NOT a construction record (e.g., selfie, random photo, meme), return TYPE: irrelevant with a brief reason.
6. If text is unclear or partially readable, extract what you can and note uncertainties in the SUMMARY field.
7. Always respond in the exact format specified below.
8. Respond in English.
9. Double-check your extraction before finalizing — verify counts, totals, and data integrity.
10. For handwritten documents: pay extra attention to similar characters (O vs 0, I vs 1, S vs 5, 6 vs 8)
11. For tables/grids: read row by row to avoid mixing data between workers or items
12. For attendance sheets with checkmarks (✓) or X marks: count them to determine days present/absent

OUTPUT FORMAT (for each record found, separated by ---):

RECORD_N:
TYPE: attendance|expense|irrelevant
PROJECT: project title from image
PROJECT_CODE: project code if visible (e.g., PRJ-001)
CONFIDENCE: high|medium|low
STRUCTURED_DATA: {json here}
SUMMARY: {brief human-readable summary}
IRRELEVANT_REASON: {only if TYPE is irrelevant}
---

For ATTENDANCE records, STRUCTURED_DATA should contain:

FORMAT A — Single-day attendance:
{
  "date": "YYYY-MM-DD",
  "location": "city/location",
  "workers": [
    {"name": "Full Name", "position": "role", "daily_rate": 800, "time_in": "7:30 AM", "time_out": "5:00 PM", "hours": 9.5}
  ]
}

FORMAT B — Weekly attendance sheet (with P/A/L/H marks per day):
Use this when you see a grid/table with worker names as rows and dates as columns,
with P (Present), A (Absent), L (Late), H (Half Day) marks in each cell.
{
  "date": "YYYY-MM-DD to YYYY-MM-DD",
  "date_range_start": "YYYY-MM-DD",
  "date_range_end": "YYYY-MM-DD",
  "location": "city/location",
  "workers": [
    {
      "name": "Full Name",
      "position": "role or foreman",
      "daily_rate": 800,
      "days_present": 13,
      "days_absent": 2,
      "attendance": {
        "M/D": "P or A or L or H",
        "M/D": "P or A or L or H"
      }
    }
  ]
}

IMPORTANT rules for weekly attendance:
- Use format "M/D" (e.g. "8/16", "8/17") as keys in the attendance map
- P = Present (8 hours), A = Absent (0 hours), L = Late (8 hours, mark as late), H = Half Day (4 hours)
- Count total days_present and days_absent for each worker
- Extract the week period from the form header (e.g. "AUGUST 16 - AUGUST 31")
- Set date_range_start and date_range_end as full dates (use current year if not specified)

For EXPENSE records, STRUCTURED_DATA should contain:
{
  "date": "YYYY-MM-DD",
  "location": "city/location",
  "items": [
    {"description": "Item name", "category": "__CATEGORY_VALUES__", "quantity": 1, "unit_price": 1000, "amount": 1000}
  ],
  "subtotal": 7700,
  "tax": 0,
  "total": 7700,
  "receipt_number": "INV-001",
  "paid_by": "Name",
  "payment_method": "Cash/Card",
  "remarks": "notes"
}

If only one record is found, only return RECORD_1 block.
PROMPT;

        return str_replace('__CATEGORY_VALUES__', $categoryValues, $prompt);
    }

    /**
     * Raw request to OpenRouter chat/completions endpoint.
     */
    protected function request(string $model, array $messages, array $extra = []): array
    {
        if (empty($this->apiKey)) {
            return [
                'error'   => true,
                'message' => 'OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your .env file.',
            ];
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'HTTP-Referer'  => config('app.url'),
                'X-Title'       => config('app.name', 'Fortress System'),
                'Content-Type'  => 'application/json',
            ])->timeout(120)->post("{$this->baseUrl}/chat/completions", array_merge([
                'model'      => $model,
                'messages'   => $messages,
                'max_tokens' => 4096,
            ], $extra));

            if ($response->failed()) {
                Log::error('OpenRouter API error', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);

                $status = $response->status();
                $errorMessage = $response->json('error.message', '');

                // Detect specific error types for user-friendly messages
                if ($status === 402 || str_contains($errorMessage, 'more credits') || str_contains($errorMessage, '402')) {
                    return [
                        'error'   => true,
                        'code'    => 'insufficient_credits',
                        'message' => 'Insufficient OpenRouter credits. The AI account needs more credits to process this request. Please add credits at https://openrouter.ai/settings/credits',
                        'details' => $errorMessage,
                    ];
                }

                return [
                    'error'   => true,
                    'message' => 'OpenRouter API returned status ' . $status,
                    'details' => $errorMessage,
                ];
            }

            return $response->json();
        } catch (\Exception $e) {
            Log::error('OpenRouter request failed', ['exception' => $e->getMessage()]);

            return [
                'error'   => true,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Extract the assistant's text reply from a chat completion response.
     */
    public static function extractContent(array $response): ?string
    {
        return $response['choices'][0]['message']['content'] ?? null;
    }
}
