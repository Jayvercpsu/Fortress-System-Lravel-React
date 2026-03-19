<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ReportsController extends Controller
{
    public function __construct(
        private readonly ReportService $reportService
    ) {
    }

    public function index(Request $request)
    {
        $this->reportService->ensureAuthorized($request->user());
        $payload = $this->reportService->indexPayload($request);

        return Inertia::render($payload['page'], $payload['props']);
    }
}
