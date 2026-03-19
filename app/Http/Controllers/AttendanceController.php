<?php

namespace App\Http\Controllers;

use App\Services\AttendanceService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AttendanceController extends Controller
{
    public function __construct(
        private readonly AttendanceService $attendanceService
    ) {
    }

    public function index(Request $request)
    {
        $this->attendanceService->ensureAuthorized($request->user());

        return Inertia::render(
            $this->attendanceService->pageByRole($request->user(), 'Index'),
            $this->attendanceService->indexPayload($request)
        );
    }

    public function summary(Request $request)
    {
        $this->attendanceService->ensureAuthorized($request->user());

        return Inertia::render(
            $this->attendanceService->pageByRole($request->user(), 'Summary'),
            $this->attendanceService->summaryPayload($request)
        );
    }
}
