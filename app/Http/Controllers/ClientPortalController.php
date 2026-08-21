<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ClientPortalService;
use App\Services\ProjectService;
use App\Services\PublicProgressService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClientPortalController extends Controller
{
    public function __construct(
        private readonly ClientPortalService $clientPortalService,
        private readonly ProjectService $projectService,
        private readonly PublicProgressService $publicProgressService
    ) {
    }

    public function index(Request $request)
    {
        $client = $request->user();
        if ($client instanceof User && $client->role === User::ROLE_CLIENT) {
            $project = $this->clientPortalService->latestClientProject($client);
            if ($project) {
                // Always render the in-progress receipt inline at /client/portal so the
                // client stays on the same URL whether or not a foreman/token exists yet.
                $token = $this->projectService->resolveProjectReceiptToken($project);

                return $this->publicProgressService->projectReceiptResponse($project, $token, true);
            }
        }

        return Inertia::render('Client/Dashboard', $this->clientPortalService->dashboardPayload($request));
    }
}
