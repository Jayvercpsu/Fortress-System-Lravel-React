<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ClientPortalService;
use App\Services\ProjectService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClientPortalController extends Controller
{
    public function __construct(
        private readonly ClientPortalService $clientPortalService,
        private readonly ProjectService $projectService
    ) {
    }

    public function index(Request $request)
    {
        $client = $request->user();
        if ($client instanceof User && $client->role === User::ROLE_CLIENT) {
            $project = $this->clientPortalService->latestClientProject($client);
            if ($project) {
                try {
                    $token = $this->projectService->resolveProjectReceiptToken($project);

                    return redirect()->route('public.progress-receipt', ['token' => $token]);
                } catch (\Throwable $e) {
                    // No foreman/token available yet — fall back to the dashboard below.
                }
            }
        }

        return Inertia::render('Client/Dashboard', $this->clientPortalService->dashboardPayload($request));
    }
}
