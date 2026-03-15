<?php

namespace App\Http\Controllers;

use App\Models\DesignProject;
use App\Models\ProgressPhoto;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\WeeklyAccomplishment;
use App\Support\ProjectSelection;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClientPortalController extends Controller
{
    public function index(Request $request)
    {
        $client = $request->user();
        abort_unless($client && $client->role === 'client', 403);

        $assignment = ProjectAssignment::query()
            ->where('user_id', $client->id)
            ->where('role_in_project', 'client')
            ->latest('id')
            ->first();

        $assignedProjectId = (int) ($assignment?->project_id ?? 0);
        $familyProjectIds = $assignedProjectId > 0
            ? ProjectSelection::familyIdsFor($assignedProjectId)
            : [];

        if (empty($familyProjectIds) && $assignedProjectId > 0) {
            $familyProjectIds = [$assignedProjectId];
        }

        $summaryProject = null;
        if (!empty($familyProjectIds)) {
            $summaryProject = Project::query()
                ->whereIn('id', $familyProjectIds)
                ->orderByRaw("
                    CASE
                        WHEN LOWER(TRIM(COALESCE(phase, ''))) = 'construction' THEN 0
                        WHEN LOWER(TRIM(COALESCE(phase, ''))) = 'completed' THEN 1
                        WHEN LOWER(TRIM(COALESCE(phase, ''))) = 'design' THEN 2
                        ELSE 3
                    END
                ")
                ->orderByDesc('updated_at')
                ->first();
        }

        $assignedProjectName = null;
        if ($assignedProjectId > 0) {
            $rootMap = ProjectSelection::rootIdMapForIds([$assignedProjectId]);
            $rootProjectId = (int) ($rootMap[$assignedProjectId] ?? $assignedProjectId);

            $familyOption = ProjectSelection::familyFilterOptionsForIds([$assignedProjectId])
                ->firstWhere('id', $rootProjectId);

            $assignedProjectName = $familyOption['name'] ?? null;
        }

        $contractAmount = (float) ($summaryProject?->contract_amount ?? 0);
        $totalClientPayment = (float) ($summaryProject?->total_client_payment ?? 0);
        $remainingBalance = (float) ($summaryProject?->remaining_balance ?? 0);

        $designDownpayment = 0.0;
        if (!empty($familyProjectIds)) {
            $rootMap = ProjectSelection::rootIdMapForIds($familyProjectIds);
            $rootId = $summaryProject?->id ? (int) ($rootMap[$summaryProject->id] ?? $summaryProject->id) : null;
            if (($rootId ?? 0) > 0) {
                $designDownpayment = (float) (DesignProject::query()
                    ->where('project_id', $rootId)
                    ->value('downpayment') ?? 0);
            }
        }

        $downpaymentAmount = $designDownpayment > 0 ? $designDownpayment : $totalClientPayment;
        $downpaymentPercent = $contractAmount > 0
            ? round(($downpaymentAmount / $contractAmount) * 100, 2)
            : 0.0;
        $downpaymentPercent = max(0.0, min(100.0, $downpaymentPercent));

        [$photos, $photoTable] = $this->photoTablePayload($request, $familyProjectIds);
        [$accomplishments, $accomplishmentTable] = $this->accomplishmentTablePayload($request, $familyProjectIds);

        return Inertia::render('Client/Dashboard', [
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
        ]);
    }

    private function photoTablePayload(Request $request, array $projectIds): array
    {
        $allowedPerPage = [10, 25, 50];
        $search = trim((string) $request->query('photos_search', ''));
        $perPage = (int) $request->query('photos_per_page', 10);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $query = ProgressPhoto::query()
            ->with('foreman:id,fullname', 'project:id,name')
            ->when(
                empty($projectIds),
                fn ($builder) => $builder->whereRaw('0 = 1'),
                fn ($builder) => $builder->whereIn('project_id', $projectIds)
            );

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('caption', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($foremanQuery) => $foremanQuery->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($projectQuery) => $projectQuery->where('name', 'like', "%{$search}%"));
            });
        }

        $paginator = $query
            ->latest()
            ->paginate($perPage, ['*'], 'photos_page')
            ->withQueryString();

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

        $query = WeeklyAccomplishment::query()
            ->with('foreman:id,fullname', 'project:id,name')
            ->when(
                empty($projectIds),
                fn ($builder) => $builder->whereRaw('0 = 1'),
                fn ($builder) => $builder->whereIn('project_id', $projectIds)
            );

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('scope_of_work', 'like', "%{$search}%")
                    ->orWhere('week_start', 'like', "%{$search}%")
                    ->orWhereHas('foreman', fn ($foremanQuery) => $foremanQuery->where('fullname', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($projectQuery) => $projectQuery->where('name', 'like', "%{$search}%"));
            });
        }

        $paginator = $query
            ->latest()
            ->paginate($perPage, ['*'], 'accomplishments_page')
            ->withQueryString();

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
