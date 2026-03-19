<?php

namespace App\Http\Controllers;

use App\Services\DeliveryConfirmationService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeliveryConfirmationController extends Controller
{
    public function __construct(
        private readonly DeliveryConfirmationService $deliveryConfirmationService
    ) {
    }

    public function index(Request $request)
    {
        $this->deliveryConfirmationService->ensureAuthorized($request->user());
        $payload = $this->deliveryConfirmationService->indexPayload($request);

        return Inertia::render($payload['page'], $payload['props']);
    }
}
