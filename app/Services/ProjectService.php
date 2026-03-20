<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Models\DesignProject;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectWorker;
use App\Models\User;
use App\Models\Worker;
use App\Repositories\Contracts\ProjectRepositoryInterface;
use App\Support\DesignComputation;
use App\Support\Projects\ProjectFlow;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ProjectService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly ProjectRepositoryInterface $projectRepository
    ) {
    }

    public function storeProject(array $validated): Project
    {
        $validated['assigned_role'] = ProjectFlow::normalizeAssignedRoleList($validated['assigned_role'] ?? null);
        $validated['status'] = ProjectFlow::normalizeStatus($validated['status'] ?? null);
        $validated['phase'] = ProjectFlow::normalizePhase($validated['phase'] ?? null);
        $validated['overall_progress'] = 0;

        $project = $this->projectRepository->createProject($validated);
        $this->projectRepository->syncLegacyForemanAssignments($project);

        return $project;
    }

    public function foremanOptionsPayload(): array
    {
        return $this->projectRepository
            ->foremanOptions()
            ->map(fn ($user) => [
                'id' => (int) $user->id,
                'fullname' => (string) $user->fullname,
            ])
            ->values()
            ->all();
    }

    public function clientOptionsPayload(): array
    {
        $clients = $this->projectRepository->clientUsers();
        $clientIds = $clients
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $assignments = $this->projectRepository->latestClientAssignmentsByUserIds($clientIds);

        return $clients
            ->map(function ($user) use ($assignments) {
                $assignment = $assignments->get((int) $user->id);
                $projectName = $assignment?->project?->name;
                $label = $projectName
                    ? "{$user->fullname} ({$projectName})"
                    : "{$user->fullname} (Unassigned)";

                return [
                    'id' => (int) $user->id,
                    'label' => $label,
                    'value' => (string) $user->fullname,
                ];
            })
            ->values()
            ->all();
    }

    public function indexPayload(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $batchSize = 5;

        $searchQuery = Project::query();
        $this->applyProjectSearchFilter($searchQuery, $search);
        $totalMatching = (clone $searchQuery)->count();

        $boardColumns = collect(ProjectFlow::phases())->map(function (string $phase) use ($request, $search, $batchSize) {
            $pageParam = $this->projectPhasePageParam($phase);
            $loadedPages = max(1, (int) $request->query($pageParam, 1));
            $visibleLimit = $loadedPages * $batchSize;

            $phaseQuery = Project::query();
            $this->applyProjectSearchFilter($phaseQuery, $search);
            $this->applyProjectPhaseFilter($phaseQuery, $phase);

            $total = (clone $phaseQuery)->count();

            $items = $phaseQuery
                ->with(['designTracker:id,project_id,design_contract_amount,total_received,design_progress,client_approval_status'])
                ->withCount('transferredProjects')
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit($visibleLimit)
                ->get()
                ->map(fn (Project $project) => $this->projectIndexCardPayload($project))
                ->values();

            $visibleCount = $items->count();
            $lastPage = max(1, (int) ceil(($total ?: 0) / $batchSize));

            return [
                'key' => strtolower((string) preg_replace('/[^a-z0-9]+/i', '', $phase)),
                'label' => $phase,
                'value' => $phase,
                'page_param' => $pageParam,
                'per_page' => $batchSize,
                'current_page' => min($loadedPages, $lastPage),
                'last_page' => $lastPage,
                'total' => $total,
                'shown' => $visibleCount,
                'remaining' => max(0, $total - $visibleCount),
                'has_more' => $visibleCount < $total,
                'projects' => $items,
            ];
        })->values();

        $projects = $boardColumns
            ->flatMap(fn (array $column) => $column['projects'])
            ->values();

        $page = $request->user()->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Projects/Index'
            : 'Admin/Projects/Index';

        return [
            'page' => $page,
            'props' => [
                'projects' => $projects,
                'projectBoard' => [
                    'search' => $search,
                    'phase_order' => ProjectFlow::phases(),
                    'batch_size' => $batchSize,
                    'total' => $totalMatching,
                    'columns' => $boardColumns,
                ],
                'projectTable' => [
                    'search' => $search,
                    'per_page' => $batchSize,
                    'current_page' => 1,
                    'last_page' => 1,
                    'total' => $totalMatching,
                    'from' => $totalMatching > 0 ? 1 : null,
                    'to' => $projects->count() > 0 ? $projects->count() : null,
                ],
            ],
        ];
    }

    public function showPayload(Request $request, Project $project): array
    {
        $payload = $this->projectPayload($project);
        $teamRows = collect($this->projectTeamPayload($project));

        $teamSearch = trim((string) $request->query('team_search', ''));
        $teamPerPage = (int) $request->query('team_per_page', 5);
        if (!in_array($teamPerPage, self::ALLOWED_PER_PAGE, true)) {
            $teamPerPage = 5;
        }

        if ($teamSearch !== '') {
            $needle = mb_strtolower($teamSearch);
            $teamRows = $teamRows->filter(function (array $row) use ($needle) {
                return collect([
                    $row['display_name'] ?? null,
                    $row['worker_name'] ?? null,
                    $row['user_role'] ?? null,
                    $row['source'] ?? null,
                    isset($row['user_id']) ? (string) $row['user_id'] : null,
                    isset($row['rate']) ? (string) $row['rate'] : null,
                ])->filter()->contains(function ($value) use ($needle) {
                    return str_contains(mb_strtolower((string) $value), $needle);
                });
            })->values();
        }

        $teamPaginator = $this->paginateCollection(
            $teamRows,
            $teamPerPage,
            'team_page',
            $request
        );

        $filesSearch = trim((string) $request->query('files_search', ''));
        $filesPerPage = (int) $request->query('files_per_page', 5);
        if (!in_array($filesPerPage, self::ALLOWED_PER_PAGE, true)) {
            $filesPerPage = 5;
        }

        $filesQuery = $project->files()->with('uploader:id,fullname');
        if ($filesSearch !== '') {
            $filesQuery->where(function ($query) use ($filesSearch) {
                $query
                    ->where('original_name', 'like', "%{$filesSearch}%")
                    ->orWhereHas('uploader', fn ($uploader) => $uploader->where('fullname', 'like', "%{$filesSearch}%"));
            });
        }

        $filesPaginator = $filesQuery
            ->latest()
            ->paginate($filesPerPage, ['*'], 'files_page')
            ->withQueryString();

        $files = collect($filesPaginator->items())
            ->map(fn ($file) => [
                'id' => $file->id,
                'file_path' => $file->file_path,
                'original_name' => $file->original_name,
                'uploaded_by' => $file->uploaded_by,
                'uploaded_by_name' => $file->uploader?->fullname,
                'created_at' => optional($file->created_at)?->toDateTimeString(),
            ])
            ->values();

        $updatesSearch = trim((string) $request->query('updates_search', ''));
        $updatesPerPage = (int) $request->query('updates_per_page', 5);
        if (!in_array($updatesPerPage, self::ALLOWED_PER_PAGE, true)) {
            $updatesPerPage = 5;
        }

        $updatesQuery = $project->updates()->with('creator:id,fullname');
        if ($updatesSearch !== '') {
            $updatesQuery->where(function ($query) use ($updatesSearch) {
                $query
                    ->where('note', 'like', "%{$updatesSearch}%")
                    ->orWhereHas('creator', fn ($creator) => $creator->where('fullname', 'like', "%{$updatesSearch}%"));
            });
        }

        $updatesPaginator = $updatesQuery
            ->latest()
            ->paginate($updatesPerPage, ['*'], 'updates_page')
            ->withQueryString();

        $updates = collect($updatesPaginator->items())
            ->map(fn ($update) => [
                'id' => $update->id,
                'note' => $update->note,
                'created_by' => $update->created_by,
                'created_by_name' => $update->creator?->fullname,
                'created_at' => optional($update->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Projects/Show'
            : 'Admin/Projects/Show';

        return [
            'page' => $page,
            'props' => [
                'project' => $payload,
                'foremen' => $this->foremanOptionsPayload(),
                'assignedTeam' => $teamPaginator->items(),
                'assignedTeamTable' => [
                    'search' => $teamSearch,
                    'per_page' => $teamPaginator->perPage(),
                    'current_page' => $teamPaginator->currentPage(),
                    'last_page' => max(1, $teamPaginator->lastPage()),
                    'total' => $teamPaginator->total(),
                    'from' => $teamPaginator->firstItem(),
                    'to' => $teamPaginator->lastItem(),
                ],
                'files' => $files,
                'fileTable' => [
                    'search' => $filesSearch,
                    'per_page' => $filesPaginator->perPage(),
                    'current_page' => $filesPaginator->currentPage(),
                    'last_page' => max(1, $filesPaginator->lastPage()),
                    'total' => $filesPaginator->total(),
                    'from' => $filesPaginator->firstItem(),
                    'to' => $filesPaginator->lastItem(),
                ],
                'updates' => $updates,
                'updateTable' => [
                    'search' => $updatesSearch,
                    'per_page' => $updatesPaginator->perPage(),
                    'current_page' => $updatesPaginator->currentPage(),
                    'last_page' => max(1, $updatesPaginator->lastPage()),
                    'total' => $updatesPaginator->total(),
                    'from' => $updatesPaginator->firstItem(),
                    'to' => $updatesPaginator->lastItem(),
                ],
            ],
        ];
    }

    public function editPayload(Project $project): array
    {
        return [
            'page' => 'HeadAdmin/Projects/Edit',
            'props' => [
                'project' => $this->projectPayload($project),
                'foremen' => $this->foremanOptionsPayload(),
                'clientOptions' => $this->clientOptionsPayload(),
            ],
        ];
    }

    public function editFinancialsPayload(Request $request, Project $project): array
    {
        $page = $request->user()->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Projects/Financials'
            : 'HR/ProjectFinancials';

        return [
            'page' => $page,
            'props' => [
                'project' => $this->projectFinancialPayload($project),
            ],
        ];
    }

    public function projectShowQueryParams(Request $request): array
    {
        return array_filter([
            'tab' => $request->query('tab'),
            'files_search' => $request->query('files_search'),
            'files_per_page' => $request->query('files_per_page'),
            'files_page' => $request->query('files_page'),
            'team_search' => $request->query('team_search'),
            'team_per_page' => $request->query('team_per_page'),
            'team_page' => $request->query('team_page'),
            'updates_search' => $request->query('updates_search'),
            'updates_per_page' => $request->query('updates_per_page'),
            'updates_page' => $request->query('updates_page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    public function projectIndexQueryParams(Request $request): array
    {
        $params = [
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ];

        foreach (ProjectFlow::phases() as $phase) {
            $pageParam = $this->projectPhasePageParam($phase);
            $params[$pageParam] = $request->query($pageParam);
        }

        return array_filter($params, fn ($value) => $value !== null && $value !== '');
    }

    public function projectPayload(Project $project): array
    {
        $computed = $this->computedTrackerMetrics($project);

        return [
            'id' => $project->id,
            'name' => $project->name,
            'client' => $project->client,
            'type' => $project->type,
            'location' => $project->location,
            'assigned_role' => ProjectFlow::normalizeAssignedRoleList($project->assigned_role ?? null),
            'assigned' => $project->assigned,
            'target' => optional($project->target)->toDateString(),
            'status' => ProjectFlow::normalizeStatus($project->status),
            'phase' => ProjectFlow::normalizePhase($project->phase),
            'source_project_id' => $project->source_project_id !== null ? (int) $project->source_project_id : null,
            'overall_progress' => $computed['overall_progress'],
            'contract_amount' => $computed['contract_amount'],
            'design_fee' => (float) ($project->design_fee ?? 0),
            'construction_cost' => $computed['construction_cost'],
            'total_client_payment' => $computed['total_client_payment'],
            'remaining_balance' => $computed['remaining_balance'],
            'last_paid_date' => $computed['last_paid_date'],
            'computation_sources' => $computed['computation_sources'] ?? [],
            'can_transfer_to_construction' => $computed['can_transfer_to_construction'] ?? false,
            'transfer_to_construction_used' => $computed['transfer_to_construction_used'] ?? false,
            'can_transfer_to_completed' => $computed['can_transfer_to_completed'] ?? false,
        ];
    }

    public function projectFinancialPayload(Project $project): array
    {
        return [
            'id' => $project->id,
            'name' => $project->name,
            'client' => $project->client,
            'type' => $project->type,
            'location' => $project->location,
            'assigned_role' => ProjectFlow::normalizeAssignedRoleList($project->assigned_role ?? null),
            'assigned' => $project->assigned,
            'target' => optional($project->target)->toDateString(),
            'phase' => ProjectFlow::normalizePhase($project->phase),
            'status' => ProjectFlow::normalizeStatus($project->status),
            'overall_progress' => (int) ($project->overall_progress ?? 0),
            'contract_amount' => (float) ($project->contract_amount ?? 0),
            'design_fee' => (float) ($project->design_fee ?? 0),
            'construction_cost' => (float) ($project->construction_cost ?? 0),
            'total_client_payment' => (float) ($project->total_client_payment ?? 0),
            'remaining_balance' => (float) ($project->remaining_balance ?? 0),
            'last_paid_date' => optional($project->last_paid_date)->toDateString(),
        ];
    }

    public function projectTeamPayload(Project $project): array
    {
        $projectWorkers = $this->projectRepository->projectWorkersWithForeman((int) $project->id);

        $projectWorkersByName = $projectWorkers
            ->filter(fn (Worker $worker) => trim((string) ($worker->name ?? '')) !== '')
            ->keyBy(fn (Worker $worker) => strtolower(trim((string) $worker->name)));

        $teamMembers = $this->projectRepository
            ->projectTeamMembers($project)
            ->map(function (ProjectWorker $teamMember) use ($projectWorkersByName) {
                $matchedWorker = null;

                if (!$teamMember->user_id && trim((string) ($teamMember->worker_name ?? '')) !== '') {
                    $matchedWorker = $projectWorkersByName->get(strtolower(trim((string) $teamMember->worker_name)));
                }

                return [
                    'id' => $teamMember->id,
                    'project_id' => $teamMember->project_id,
                    'user_id' => $teamMember->user_id,
                    'worker_name' => $teamMember->worker_name,
                    'display_name' => $teamMember->user?->fullname ?: $teamMember->worker_name,
                    'source' => $teamMember->user_id ? 'user' : 'manual',
                    'user_role' => $teamMember->user?->role,
                    'rate' => (float) $teamMember->rate,
                    'birth_date' => optional($matchedWorker?->birth_date)?->toDateString(),
                    'place_of_birth' => $matchedWorker?->place_of_birth,
                    'sex' => $matchedWorker?->sex,
                    'civil_status' => $matchedWorker?->civil_status,
                    'phone' => $matchedWorker?->phone,
                    'address' => $matchedWorker?->address,
                    'managed_by_foreman_name' => $matchedWorker?->foreman?->fullname,
                ];
            })
            ->values();

        $existingManualNames = $teamMembers
            ->filter(fn ($row) => empty($row['user_id']) && !empty($row['worker_name']))
            ->map(fn ($row) => strtolower(trim((string) $row['worker_name'])))
            ->filter()
            ->unique()
            ->values();

        $foremanWorkers = $projectWorkers
            ->reject(function (Worker $worker) use ($existingManualNames) {
                $nameKey = strtolower(trim((string) ($worker->name ?? '')));
                return $nameKey !== '' && $existingManualNames->contains($nameKey);
            })
            ->map(fn (Worker $worker) => [
                'id' => 'fw-' . $worker->id,
                'project_id' => $project->id,
                'user_id' => null,
                'worker_name' => $worker->name,
                'display_name' => $worker->name,
                'source' => 'manual',
                'user_role' => null,
                'rate' => (float) ($worker->default_rate_per_hour ?? 0),
                'birth_date' => optional($worker->birth_date)?->toDateString(),
                'place_of_birth' => $worker->place_of_birth,
                'sex' => $worker->sex,
                'civil_status' => $worker->civil_status,
                'phone' => $worker->phone,
                'address' => $worker->address,
                'managed_by_foreman_name' => $worker->foreman?->fullname,
            ]);

        return $teamMembers
            ->concat($foremanWorkers)
            ->values()
            ->all();
    }

    private function computedTrackerMetrics(Project $project): array
    {
        $projectId = (int) $project->id;
        $design = $this->projectRepository->findDesignByProjectId($projectId);
        $build = $this->projectRepository->findBuildByProjectId($projectId);
        $sourceDesign = null;

        if ($project->source_project_id !== null) {
            $sourceDesign = $this->projectRepository->findDesignByProjectId((int) $project->source_project_id);
        }

        $designContractAmount = (float) ($design?->design_contract_amount ?? 0);
        $resolvedDesign = $sourceDesign ?: $design;

        $manualContractAmount = (float) ($project->contract_amount ?? 0);
        $manualConstructionCost = (float) ($project->construction_cost ?? 0);
        $manualTotalClientPayment = (float) ($project->total_client_payment ?? 0);
        $manualLastPaidDate = $project->last_paid_date ? $project->last_paid_date->toDateString() : null;

        $constructionContract = (float) ($build?->construction_contract ?? 0);
        $expenseConstructionCost = $this->projectRepository->expenseTotalByProjectId($projectId);
        $constructionCost = $expenseConstructionCost > 0 ? $expenseConstructionCost : $manualConstructionCost;
        $expenseCategoryTotals = $this->projectRepository->expenseCategoryTotalsByProjectId($projectId);

        $contractAmount = $designContractAmount + $constructionContract;
        if ($contractAmount <= 0 && $manualContractAmount > 0) {
            $contractAmount = $manualContractAmount;
        }

        $totalClientPayment = $this->projectRepository->paymentTotalByProjectId($projectId);
        if ($totalClientPayment <= 0 && $manualTotalClientPayment > 0) {
            $totalClientPayment = $manualTotalClientPayment;
        }

        $lastPaidDate = $this->projectRepository->lastPaymentDateByProjectId($projectId);
        if (!$lastPaidDate && $manualLastPaidDate) {
            $lastPaidDate = $manualLastPaidDate;
        }

        $remainingBalance = $contractAmount - $totalClientPayment;
        $manualDesignFee = (float) ($project->design_fee ?? 0);
        $designPayloadContractAmount = (float) ($resolvedDesign?->design_contract_amount ?? 0);
        $designPayloadTotalReceived = (float) ($resolvedDesign?->total_received ?? 0);
        $designPayloadDownpayment = (float) ($resolvedDesign?->downpayment ?? 0);
        $designPayloadOfficePayrollDeduction = (float) ($resolvedDesign?->office_payroll_deduction ?? 0);
        $designPayloadProgress = DesignComputation::computeProgress(
            $designPayloadContractAmount,
            $designPayloadTotalReceived,
            (string) ($resolvedDesign?->client_approval_status ?? DesignProject::CLIENT_APPROVAL_PENDING)
        );
        $designPayloadCollectionProgressPct = DesignComputation::computeCollectionPercent(
            $designPayloadContractAmount,
            $designPayloadTotalReceived
        );
        $designPayloadRemaining = $designPayloadContractAmount - $designPayloadTotalReceived;
        $designPayloadNetAfterOfficeDeduction = $designPayloadTotalReceived - $designPayloadOfficePayrollDeduction;
        $designTrackerSharePct = $contractAmount > 0 ? ($designPayloadContractAmount / $contractAmount) * 100 : 0;
        $manualDesignFeeSharePct = $contractAmount > 0 ? ($manualDesignFee / $contractAmount) * 100 : 0;
        $buildTrackerClientPayment = (float) ($build?->total_client_payment ?? 0);
        $buildMaterialsCost = (float) ($build?->materials_cost ?? 0);
        $buildLaborCost = (float) ($build?->labor_cost ?? 0);
        $buildEquipmentCost = (float) ($build?->equipment_cost ?? 0);
        $buildTrackerSubtotalCosts = $buildMaterialsCost + $buildLaborCost + $buildEquipmentCost;
        $buildVarianceFromTrackerBudget = $constructionContract - $constructionCost;
        $collectionProgressPct = $contractAmount > 0 ? ($totalClientPayment / $contractAmount) * 100 : 0;
        $phase = ProjectFlow::normalizePhase($project->phase);
        $transferredCount = (int) ($project->transferred_projects_count ?? $this->projectRepository->transferredProjectsCount($projectId));
        $overallProgress = $phase === 'Design'
            ? (int) max(0, min(100, (int) $designPayloadProgress))
            : (int) max(0, min(100, (int) ($project->overall_progress ?? 0)));
        $normalizedStatus = ProjectFlow::normalizeStatus($project->status);
        $hasTransferredConstruction = $phase === 'Design' && $transferredCount > 0;
        $canTransferToConstruction = $phase === 'Design'
            && $project->source_project_id === null
            && !$hasTransferredConstruction
            && $normalizedStatus === ProjectStatus::COMPLETED->value;
        $canTransferToCompleted = $phase === 'Construction' && $normalizedStatus === ProjectStatus::COMPLETED->value;

        if ($resolvedDesign && (int) $resolvedDesign->design_progress !== $designPayloadProgress) {
            $this->projectRepository->persistDesignProgress($resolvedDesign, (int) $designPayloadProgress);
        }

        return [
            'contract_amount' => $contractAmount,
            'design_fee' => $designContractAmount,
            'construction_cost' => $constructionCost,
            'total_client_payment' => $totalClientPayment,
            'remaining_balance' => $remainingBalance,
            'last_paid_date' => $lastPaidDate,
            'overall_progress' => $overallProgress,
            'can_transfer_to_construction' => $canTransferToConstruction,
            'transfer_to_construction_used' => $hasTransferredConstruction,
            'can_transfer_to_completed' => $canTransferToCompleted,
            'computation_sources' => [
                'design_tracker' => [
                    'design_contract_amount' => $designPayloadContractAmount,
                    'downpayment' => $designPayloadDownpayment,
                    'total_received' => $designPayloadTotalReceived,
                    'office_payroll_deduction' => $designPayloadOfficePayrollDeduction,
                    'net_after_office_payroll_deduction' => $designPayloadNetAfterOfficeDeduction,
                    'remaining_design_balance' => $designPayloadRemaining,
                    'design_progress' => $designPayloadProgress,
                    'collection_progress_pct' => $designPayloadCollectionProgressPct,
                    'client_approval_status' => $resolvedDesign?->client_approval_status ?: DesignProject::CLIENT_APPROVAL_PENDING,
                    'source_project_id' => $project->source_project_id !== null ? (int) $project->source_project_id : null,
                    'is_inherited_from_source' => $project->source_project_id !== null && $sourceDesign !== null,
                    'share_of_total_budget_pct' => $designTrackerSharePct,
                    'computation_basis' => DesignComputation::milestoneBreakdown($designPayloadContractAmount),
                    'computation_basis_total_percent' => DesignComputation::totalBasisPercent(),
                ],
                'build_tracker' => [
                    'construction_contract' => $constructionContract,
                    'recorded_total_client_payment' => $buildTrackerClientPayment,
                    'materials_cost' => $buildMaterialsCost,
                    'labor_cost' => $buildLaborCost,
                    'equipment_cost' => $buildEquipmentCost,
                    'tracker_cost_subtotal' => $buildTrackerSubtotalCosts,
                    'actual_expenses_total' => $constructionCost,
                    'variance_vs_actual_expenses' => $buildVarianceFromTrackerBudget,
                    'actual_expenses_by_category' => $expenseCategoryTotals,
                ],
                'finance_actuals' => [
                    'payments_total' => $totalClientPayment,
                    'collection_progress_pct' => $collectionProgressPct,
                    'remaining_balance' => $remainingBalance,
                    'last_paid_date' => $lastPaidDate,
                ],
                'project_financials_snapshot' => [
                    'total_budget_contract_amount' => $manualContractAmount > 0 ? $manualContractAmount : $contractAmount,
                    'design_fee_manual' => $manualDesignFee,
                    'design_fee_share_of_total_budget_pct' => $manualDesignFeeSharePct,
                    'construction_cost' => $constructionCost,
                    'total_client_payment' => $totalClientPayment,
                    'remaining_balance' => $remainingBalance,
                    'last_paid_date' => $lastPaidDate,
                ],
                'sync_checks' => [
                    'design_fee_manual_minus_design_tracker_contract' => $manualDesignFee - $designContractAmount,
                    'manual_derived_build_budget' => $contractAmount - $manualDesignFee,
                    'tracker_build_budget' => $constructionContract,
                    'tracker_build_budget_minus_manual_derived_build_budget' => $constructionContract - ($contractAmount - $manualDesignFee),
                ],
                'deductions' => [
                    'design_office_payroll_deduction' => $designPayloadOfficePayrollDeduction,
                    'includes_design_office_payroll_deduction_in_project_total' => false,
                    'includes_payroll_deductions_in_project_total' => false,
                    'payroll_deductions_note' => 'Payroll deductions are not included in Project Computations because payroll rows are not linked to project_id.',
                ],
            ],
        ];
    }

    private function paginateCollection(Collection $rows, int $perPage, string $pageName, Request $request): LengthAwarePaginator
    {
        $page = max(1, (int) $request->query($pageName, 1));
        $total = $rows->count();
        $items = $rows->forPage($page, $perPage)->values();

        return (new LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $page,
            [
                'path' => $request->url(),
                'pageName' => $pageName,
            ]
        ))->appends($request->query());
    }

    private function projectIndexCardPayload(Project $project): array
    {
        $phase = ProjectFlow::normalizePhase($project->phase);
        $designProgress = DesignComputation::computeProgress(
            (float) ($project->designTracker?->design_contract_amount ?? 0),
            (float) ($project->designTracker?->total_received ?? 0),
            (string) ($project->designTracker?->client_approval_status ?? DesignProject::CLIENT_APPROVAL_PENDING)
        );
        $designApprovalStatus = ProjectFlow::normalizeDesignApprovalStatus($project->designTracker?->client_approval_status);
        $status = ProjectFlow::normalizeStatus($project->status);
        $constructionProgress = (int) max(0, min(100, (int) ($project->overall_progress ?? 0)));
        $kanbanProgress = $phase === 'Design' ? $designProgress : $constructionProgress;
        $hasTransferredConstruction = $phase === 'Design' && (int) ($project->transferred_projects_count ?? 0) > 0;
        $canTransferToConstruction = $phase === 'Design'
            && $project->source_project_id === null
            && !$hasTransferredConstruction
            && $status === ProjectStatus::COMPLETED->value;
        $canTransferToCompleted = $phase === 'Construction' && $status === ProjectStatus::COMPLETED->value;

        return [
            'id' => $project->id,
            'source_project_id' => $project->source_project_id !== null ? (int) $project->source_project_id : null,
            'name' => $project->name,
            'client' => $project->client,
            'type' => $project->type,
            'location' => $project->location,
            'assigned_role' => ProjectFlow::normalizeAssignedRoleList($project->assigned_role ?? null),
            'assigned' => $project->assigned,
            'target' => optional($project->target)->toDateString(),
            'status' => $status,
            'phase' => $phase,
            'overall_progress' => $kanbanProgress,
            'design_progress' => $designProgress,
            'design_approval_status' => $designApprovalStatus,
            'construction_progress' => $constructionProgress,
            'can_transfer_to_construction' => $canTransferToConstruction,
            'transfer_to_construction_used' => $hasTransferredConstruction,
            'can_transfer_to_completed' => $canTransferToCompleted,
            'contract_amount' => (float) ($project->contract_amount ?? 0),
            'total_client_payment' => (float) ($project->total_client_payment ?? 0),
            'remaining_balance' => (float) ($project->remaining_balance ?? 0),
            'is_new_today' => (bool) optional($project->created_at)->isToday(),
        ];
    }

    private function applyProjectSearchFilter($query, string $search): void
    {
        if ($search === '') {
            return;
        }

        $query->where(function ($builder) use ($search) {
            $builder
                ->where('name', 'like', "%{$search}%")
                ->orWhere('client', 'like', "%{$search}%")
                ->orWhere('phase', 'like', "%{$search}%")
                ->orWhere('status', 'like', "%{$search}%")
                ->orWhere('location', 'like', "%{$search}%")
                ->orWhere('assigned_role', 'like', "%{$search}%")
                ->orWhere('assigned', 'like', "%{$search}%");
        });
    }

    private function applyProjectPhaseFilter($query, string $phase): void
    {
        $keys = ProjectFlow::phaseMatchKeys($phase);

        $query->where(function ($builder) use ($keys) {
            foreach ($keys as $index => $key) {
                $method = $index === 0 ? 'whereRaw' : 'orWhereRaw';
                $builder->{$method}(
                    "LOWER(REPLACE(REPLACE(REPLACE(COALESCE(phase, ''), '-', ''), ' ', ''), '_', '')) = ?",
                    [$key]
                );
            }
        });
    }

    private function projectPhasePageParam(string $phase): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', $phase)) . '_page';
    }

    public function updateProject(Project $project, array $validated): void
    {
        $validated['assigned_role'] = ProjectFlow::normalizeAssignedRoleList($validated['assigned_role'] ?? null);
        $validated['status'] = ProjectFlow::normalizeStatus($validated['status'] ?? null);
        $validated['phase'] = ProjectFlow::normalizePhase($validated['phase'] ?? null);

        $this->projectRepository->updateProject($project, $validated);
        $this->projectRepository->syncLegacyForemanAssignments($project->fresh());
    }

    public function resolveProjectReceiptToken(Project $project): string
    {
        $foremanId = $this->projectRepository->latestForemanAssignmentUserId($project);

        if ($foremanId === null && $project->source_project_id) {
            $foremanId = $this->projectRepository->latestForemanAssignmentUserIdByProjectId((int) $project->source_project_id);
        }

        if ($foremanId === null) {
            abort(404, __('messages.projects.no_foreman_assigned'));
        }

        $token = $this->projectRepository->findActiveProgressToken((int) $project->id, $foremanId);
        if (!$token) {
            $token = $this->projectRepository->createProgressToken((int) $project->id, $foremanId);
        }

        return (string) $token->token;
    }

    public function resolveJotformLink(Project $project, int $foremanId): string
    {
        $foreman = User::query()
            ->whereKey($foremanId)
            ->where('role', User::ROLE_FOREMAN)
            ->first();

        if (!$foreman) {
            throw ValidationException::withMessages([
                'foreman_id' => 'Selected foreman is not assigned to this project.',
            ]);
        }

        $assignedNames = collect(preg_split('/[,;]+/', (string) ($project->assigned ?? '')))
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->values();

        $isAssignedByName = $assignedNames
            ->contains(fn ($name) => mb_strtolower($name) === mb_strtolower((string) $foreman->fullname));

        $isAssignedByProject = ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->where('user_id', $foremanId)
            ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->exists();

        if ($assignedNames->isNotEmpty() && !$isAssignedByName && !$isAssignedByProject) {
            throw ValidationException::withMessages([
                'foreman_id' => 'Selected foreman is not assigned to this project.',
            ]);
        }

        $token = $this->projectRepository->findActiveProgressToken((int) $project->id, $foremanId)
            ?? $this->projectRepository->createProgressToken((int) $project->id, $foremanId);

        return route('public.progress-submit.show', ['token' => $token->token]);
    }

    public function updateProjectPhase(Project $project, string $phase): void
    {
        $normalizedPhase = ProjectFlow::normalizePhase($phase);

        if (ProjectFlow::normalizePhase($project->phase) !== $normalizedPhase) {
            $this->projectRepository->updateProject($project, [
                'phase' => $normalizedPhase,
            ]);
        }
    }

    public function transferToConstruction(Project $project): void
    {
        if ($project->source_project_id !== null || ProjectFlow::normalizePhase($project->phase) !== 'Design') {
            throw ValidationException::withMessages([
                'transfer' => __('messages.projects.transfer_to_construction_only_design'),
            ]);
        }

        if ($this->projectRepository->hasTransferredProject((int) $project->id)) {
            throw ValidationException::withMessages([
                'transfer' => __('messages.projects.transfer_to_construction_already_done'),
            ]);
        }

        $this->projectRepository->createConstructionDuplicate($project);
    }

    public function transferToCompleted(Project $project): void
    {
        if (ProjectFlow::normalizePhase($project->phase) !== 'Construction') {
            throw ValidationException::withMessages([
                'transfer' => __('messages.projects.transfer_to_completed_only_construction'),
            ]);
        }

        $this->projectRepository->updateProject($project, [
            'phase' => ProjectFlow::normalizePhase('Completed'),
            'status' => (string) config('fortress.project_status_completed', ProjectStatus::COMPLETED->value),
            'overall_progress' => 100,
        ]);
    }

    public function updateAssignedForemen(Project $project, array $foremanNames): ?string
    {
        $normalizedForemanNames = collect($foremanNames)
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->unique(fn ($name) => strtolower($name))
            ->values();

        $assigned = $normalizedForemanNames->implode(', ');

        if (strlen($assigned) > 255) {
            return __('messages.projects.assigned_foremen_too_long');
        }

        $this->projectRepository->updateProject($project, [
            'assigned' => $assigned !== '' ? $assigned : null,
        ]);

        $this->projectRepository->syncLegacyForemanAssignments($project->fresh());

        return null;
    }

    public function destroyProject(Project $project): void
    {
        $this->projectRepository->deleteProjectGraph($project);
    }

    public function updateFinancials(Project $project, array $validated): void
    {
        $this->projectRepository->updateProject($project, $validated);
        $this->projectRepository->updateProject($project, [
            'remaining_balance' => (float) $validated['contract_amount'] - (float) $validated['total_client_payment'],
        ]);
    }
}
