<?php

namespace App\Http\Controllers;

use App\Services\WeeklyAccomplishmentService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WeeklyAccomplishmentController extends Controller
{
    public function __construct(
        private readonly WeeklyAccomplishmentService $weeklyAccomplishmentService
    ) {
    }

    public function index(Request $request)
    {
        $this->weeklyAccomplishmentService->ensureAuthorized($request->user());
        $payload = $this->weeklyAccomplishmentService->indexPayload($request);

        return Inertia::render($payload['page'], $payload['props']);
    }
}
