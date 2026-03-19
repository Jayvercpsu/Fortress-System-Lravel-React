<?php

namespace App\Http\Controllers;

use App\Http\Requests\Issues\UpdateIssueStatusRequest;
use App\Models\IssueReport;
use App\Services\IssueReportService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class IssueReportController extends Controller
{
    public function __construct(
        private readonly IssueReportService $issueReportService
    ) {
    }

    public function index(Request $request)
    {
        $this->issueReportService->ensureAuthorized($request->user());
        $payload = $this->issueReportService->indexPayload($request);

        return Inertia::render($payload['page'], $payload['props']);
    }

    public function updateStatus(UpdateIssueStatusRequest $request, IssueReport $issueReport)
    {
        $this->issueReportService->ensureAuthorized($request->user());
        $message = $this->issueReportService->updateStatus(
            $issueReport,
            (string) $request->validated('status')
        );

        return redirect()->back()->with('success', $message);
    }
}
