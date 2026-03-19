<?php

namespace App\Services;

use App\Models\ProgressPhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\ClientPortalRepositoryInterface;
use App\Support\ProjectSelection;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ClientPortalService
{
    public function __construct(
        private readonly ClientPortalRepositoryInterface $clientPortalRepository
    ) {
    }

    public function dashboardPayload(Request $request): array
    {
        $client = $request->user();
        abort_unless($client && $client->role === User::ROLE_CLIENT, 403);

        $assignment = $this->clientPortalRepository->latestClientAssignment((int) $client->id);
        $assignedProjectId = (int) ($assignment?->project_id ?? 0);
        $familyProjectIds = $assignedProjectId > 0
            ? ProjectSelection::familyIdsFor($assignedProjectId)
            : [];

        if (empty($familyProjectIds) && $assignedProjectId > 0) {
            $familyProjectIds = [$assignedProjectId];
        }

        $summaryProject = $this->clientPortalRepository->summaryProjectByFamilyIds($familyProjectIds);
        $assignedProjectName = $this->resolveAssignedProjectName($assignedProjectId);

        $contractAmount = (float) ($summaryProject?->contract_amount ?? 0);
        $totalClientPayment = (float) ($summaryProject?->total_client_payment ?? 0);
        $remainingBalance = (float) ($summaryProject?->remaining_balance ?? 0);
        $designDownpayment = $this->resolveDesignDownpayment($summaryProject, $familyProjectIds);

        $downpaymentAmount = $designDownpayment > 0 ? $designDownpayment : $totalClientPayment;
        $downpaymentPercent = $contractAmount > 0
            ? round(($downpaymentAmount / $contractAmount) * 100, 2)
            : 0.0;
        $downpaymentPercent = max(0.0, min(100.0, $downpaymentPercent));

        [$photos, $photoTable] = $this->photoTablePayload($request, $familyProjectIds);
        [$accomplishments, $accomplishmentTable] = $this->accomplishmentTablePayload($request, $familyProjectIds);
        $weeklyScopePhotoMap = $this->weeklyScopePhotoMap($familyProjectIds);

        return [
            'assignedProject' => [
                'id' => $summaryProject?->id,
                'name' => $assignedProjectName ?? $summaryProject?->name,
                'contract_amount' => $contractAmount,
                'downpayment_amount' => $downpaymentAmount,
                'downpayment_percent' => $downpaymentPercent,
                'remaining_balance' => $remainingBalance,
                'total_client_payment' => $totalClientPayment,
            ],
            'photos' => $photos,
            'photoTable' => $photoTable,
            'accomplishments' => $accomplishments,
            'accomplishmentTable' => $accomplishmentTable,
            'weeklyScopePhotoMap' => $weeklyScopePhotoMap,
        ];
    }

    private function resolveAssignedProjectName(int $assignedProjectId): ?string
    {
        if ($assignedProjectId <= 0) {
            return null;
        }

        $rootMap = ProjectSelection::rootIdMapForIds([$assignedProjectId]);
        $rootProjectId = (int) ($rootMap[$assignedProjectId] ?? $assignedProjectId);

        $familyOption = ProjectSelection::familyFilterOptionsForIds([$assignedProjectId])
            ->firstWhere('id', $rootProjectId);

        return $familyOption['name'] ?? null;
    }

    private function resolveDesignDownpayment(?object $summaryProject, array $familyProjectIds): float
    {
        if (empty($familyProjectIds)) {
            return 0.0;
        }

        $rootMap = ProjectSelection::rootIdMapForIds($familyProjectIds);
        $rootId = $summaryProject?->id ? (int) ($rootMap[$summaryProject->id] ?? $summaryProject->id) : null;
        if (($rootId ?? 0) <= 0) {
            return 0.0;
        }

        return $this->clientPortalRepository->designDownpaymentForProject((int) $rootId);
    }

    private function weeklyScopePhotoMap(array $projectIds): array
    {
        $nonNullProjectIds = array_values(array_filter($projectIds, fn ($value) => $value !== null));
        if (empty($nonNullProjectIds)) {
            return [];
        }

        $map = [];
        $scopePhotos = $this->clientPortalRepository->scopePhotosForProjectIds($nonNullProjectIds);

        foreach ($scopePhotos as $scopePhoto) {
            $scopeName = trim((string) ($scopePhoto->scope_name ?? ''));
            if ($scopeName === '') {
                continue;
            }

            $scopeKey = Str::lower($scopeName);
            if (!isset($map[$scopeKey])) {
                $map[$scopeKey] = [];
            }

            if (count($map[$scopeKey]) >= 8) {
                continue;
            }

            $map[$scopeKey][] = [
                'id' => (int) $scopePhoto->id,
                'photo_path' => $scopePhoto->photo_path,
                'caption' => $scopePhoto->caption,
                'created_at' => optional($scopePhoto->created_at)?->toDateTimeString(),
            ];
        }

        return $map;
    }

    private function photoTablePayload(Request $request, array $projectIds): array
    {
        $allowedPerPage = [10, 25, 50];
        $search = trim((string) $request->query('photos_search', ''));
        $perPage = (int) $request->query('photos_per_page', 10);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $paginator = $this->clientPortalRepository->paginateProgressPhotos($projectIds, $search, $perPage);

        $photos = collect($paginator->items())
            ->map(fn (ProgressPhoto $photo) => [
                'id' => $photo->id,
                'photo_path' => $photo->photo_path,
                'caption' => $photo->caption,
                'project_name' => $photo->project?->name ?? '-',
                'uploaded_by' => $photo->foreman?->fullname ?? '-',
                'created_at' => optional($photo->created_at)?->toDateTimeString(),
            ])
            ->values();

        return [
            $photos,
            [
                'search' => $search,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }

    private function accomplishmentTablePayload(Request $request, array $projectIds): array
    {
        $allowedPerPage = [10, 25, 50];
        $search = trim((string) $request->query('accomplishments_search', ''));
        $perPage = (int) $request->query('accomplishments_per_page', 10);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $paginator = $this->clientPortalRepository->paginateWeeklyAccomplishments($projectIds, $search, $perPage);

        $rows = collect($paginator->items())
            ->map(fn (WeeklyAccomplishment $accomplishment) => [
                'id' => $accomplishment->id,
                'project_name' => $accomplishment->project?->name ?? '-',
                'scope_of_work' => $accomplishment->scope_of_work,
                'percent_completed' => (float) ($accomplishment->percent_completed ?? 0),
                'week_start' => $accomplishment->week_start ? (string) $accomplishment->week_start : null,
                'submitted_by' => $accomplishment->foreman?->fullname ?? '-',
                'created_at' => optional($accomplishment->created_at)?->toDateTimeString(),
            ])
            ->values();

        return [
            $rows,
            [
                'search' => $search,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ];
    }
}
