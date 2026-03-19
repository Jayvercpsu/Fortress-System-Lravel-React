<?php

namespace App\Http\Controllers;

use App\Http\Requests\MaterialRequests\UpdateMaterialRequestStatusRequest;
use App\Models\MaterialRequest;
use App\Services\MaterialRequestService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MaterialRequestController extends Controller
{
    public function __construct(
        private readonly MaterialRequestService $materialRequestService
    ) {
    }

    public function index(Request $request)
    {
        $this->materialRequestService->ensureAuthorized($request->user());
        $payload = $this->materialRequestService->indexPayload($request);

        return Inertia::render($payload['page'], $payload['props']);
    }

    public function updateStatus(UpdateMaterialRequestStatusRequest $request, MaterialRequest $materialRequest)
    {
        $this->materialRequestService->ensureAuthorized($request->user());
        $message = $this->materialRequestService->updateStatus(
            $materialRequest,
            (string) $request->validated('status')
        );

        return redirect()->back()->with('success', $message);
    }
}
