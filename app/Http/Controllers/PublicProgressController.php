<?php

namespace App\Http\Controllers;

use App\Services\PublicProgressService;
use Illuminate\Http\Request;

class PublicProgressController extends Controller
{
    public function __construct(
        private readonly PublicProgressService $publicProgressService
    ) {
    }

    public function show(string $token)
    {
        return $this->publicProgressService->show($token);
    }

    public function receipt(Request $request, string $token)
    {
        return $this->publicProgressService->receipt($request, $token);
    }

    public function exportReceipt(Request $request, string $token)
    {
        return $this->publicProgressService->exportReceipt($request, $token);
    }

    public function store(Request $request, string $token)
    {
        return $this->publicProgressService->store($request, $token);
    }

    public function storeAll(Request $request, string $token)
    {
        return $this->publicProgressService->storeAll($request, $token);
    }

    public function storeAttendance(Request $request, string $token)
    {
        return $this->publicProgressService->storeAttendance($request, $token);
    }

    public function storeDelivery(Request $request, string $token)
    {
        return $this->publicProgressService->storeDelivery($request, $token);
    }

    public function storeMaterialRequest(Request $request, string $token)
    {
        return $this->publicProgressService->storeMaterialRequest($request, $token);
    }

    public function storeWeeklyProgress(Request $request, string $token)
    {
        return $this->publicProgressService->storeWeeklyProgress($request, $token);
    }

    public function storePhoto(Request $request, string $token)
    {
        return $this->publicProgressService->storePhoto($request, $token);
    }

    public function storeIssueReport(Request $request, string $token)
    {
        return $this->publicProgressService->storeIssueReport($request, $token);
    }
}
