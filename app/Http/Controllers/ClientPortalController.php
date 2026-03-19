<?php

namespace App\Http\Controllers;

use App\Services\ClientPortalService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClientPortalController extends Controller
{
    public function __construct(
        private readonly ClientPortalService $clientPortalService
    ) {
    }

    public function index(Request $request)
    {
        return Inertia::render('Client/Dashboard', $this->clientPortalService->dashboardPayload($request));
    }
}
