<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Services\ForemanService;
use Illuminate\Http\Request;

class ForemansController extends Controller
{
    public function __construct(
        private readonly ForemanService $foremanService
    ) {
    }

    public function attendanceIndex(Request $request)
    {
        return $this->foremanService->attendanceIndex($request);
    }

    public function timeInAttendance(Request $request)
    {
        return $this->foremanService->timeInAttendance($request);
    }

    public function timeOutAttendance(Request $request)
    {
        return $this->foremanService->timeOutAttendance($request);
    }

    public function updateAttendance(Request $request, Attendance $attendance)
    {
        return $this->foremanService->updateAttendance($request, $attendance);
    }

    public function storeAttendance(Request $request)
    {
        return $this->foremanService->storeAttendance($request);
    }

    public function submitAll(Request $request)
    {
        return $this->foremanService->submitAll($request);
    }

    public function storeProgressPhoto(Request $request)
    {
        return $this->foremanService->storeProgressPhoto($request);
    }
}
