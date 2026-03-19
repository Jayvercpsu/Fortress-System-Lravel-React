<?php

namespace App\Http\Controllers;

use App\Services\KpiService;
use Illuminate\Http\Request;

class KpiController extends Controller
{
    public function __construct(
        private readonly KpiService $kpiService
    ) {
    }

    public function index(Request $request)
    {
        return $this->kpiService->index($request);
    }

    public function print(Request $request)
    {
        return $this->kpiService->print($request);
    }

    public function export(Request $request)
    {
        return $this->kpiService->export($request);
    }
}
