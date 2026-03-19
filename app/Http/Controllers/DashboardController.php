<?php

namespace App\Http\Controllers;

use App\Services\DashboardService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        private readonly DashboardService $dashboardService
    ) {
    }

    public function headAdmin(Request $request)
    {
        return $this->dashboardService->headAdmin($request);
    }

    public function admin(Request $request)
    {
        return $this->dashboardService->admin($request);
    }

    public function hr(Request $request)
    {
        return $this->dashboardService->hr($request);
    }

    public function foreman(Request $request)
    {
        return $this->dashboardService->foreman($request);
    }

    public function foremanSubmissions(Request $request)
    {
        return $this->dashboardService->foremanSubmissions($request);
    }
}
