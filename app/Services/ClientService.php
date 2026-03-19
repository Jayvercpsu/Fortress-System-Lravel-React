<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Repositories\Contracts\ClientRepositoryInterface;
use App\Support\ProjectSelection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ClientService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly ClientRepositoryInterface $clientRepository
    ) {
    }

    public function indexPayload(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);

        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        $paginator = $this->clientRepository->paginateClients($search, $perPage);

        $users = collect($paginator->items());
        $clientIds = $users->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $assignments = $this->clientRepository->latestAssignmentsByUserIds($clientIds);

        $assignedProjectIds = $assignments->pluck('project_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $rootProjectById = ProjectSelection::rootIdMapForIds($assignedProjectIds->all());
        $projectFamilies = ProjectSelection::familyFilterOptionsForIds($assignedProjectIds->all())
            ->keyBy('id');

        $clients = $users->map(function (User $user) use ($assignments, $rootProjectById, $projectFamilies) {
            $assignment = $assignments->get($user->id);
            $assignedProjectId = (int) ($assignment?->project_id ?? 0);
            $rootProjectId = $assignedProjectId > 0
                ? (int) ($rootProjectById[$assignedProjectId] ?? $assignedProjectId)
                : 0;
            $projectFamily = $rootProjectId > 0 ? $projectFamilies->get($rootProjectId) : null;

            return [
                'id' => $user->id,
                'fullname' => $user->fullname,
                'email' => $user->email,
                'username' => $user->username,
                'phone' => $user->detail?->phone,
                'location' => $user->detail?->address,
                'assigned_project' => $projectFamily['name'] ?? $assignment?->project?->name ?? '-',
                'project_id' => $assignedProjectId ?: null,
                'created_at' => optional($user->created_at)?->toDateTimeString(),
            ];
        })->values();

        return [
            'clients' => $clients,
            'clientTable' => [
                'search' => $search,
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => max(1, $paginator->lastPage()),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'projectOptions' => $this->projectOptionsPayload(),
        ];
    }

    public function createClient(array $validated): void
    {
        $assignmentProjectId = null;
        if (!empty($validated['project_id'])) {
            $assignmentProjectId = $this->resolveClientProjectId((int) $validated['project_id']);
        }

        $client = $this->clientRepository->createClient([
            'fullname' => $validated['client_name'],
            'email' => $validated['email'] ?? null,
            'username' => $validated['username'],
            'password' => Hash::make($validated['password']),
            'role' => User::ROLE_CLIENT,
        ]);

        $this->clientRepository->upsertDetail($client, [
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['location'] ?? null,
        ]);

        if ($assignmentProjectId !== null) {
            $this->clientRepository->upsertClientAssignment($client, $assignmentProjectId);
        }
    }

    public function updateClient(User $user, array $validated): void
    {
        $this->clientRepository->updateClient($user, [
            'fullname' => $validated['client_name'],
            'email' => $validated['email'] ?? null,
            'username' => $validated['username'],
        ]);

        if (!empty($validated['password'])) {
            $this->clientRepository->updateClient($user, [
                'password' => Hash::make($validated['password']),
            ]);
        }

        $this->clientRepository->upsertDetail($user, [
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['location'] ?? null,
        ]);

        $assignmentProjectId = null;
        if (!empty($validated['project_id'])) {
            $assignmentProjectId = $this->resolveClientProjectId((int) $validated['project_id']);
        }

        if ($assignmentProjectId) {
            $this->clientRepository->upsertClientAssignment($user, $assignmentProjectId);
            $this->clientRepository->deleteOtherClientAssignments($user, $assignmentProjectId);
            return;
        }

        $this->clientRepository->deleteClientAssignments($user);
    }

    public function deleteClient(User $user): void
    {
        $this->clientRepository->deleteClient($user);
    }

    public function tableQueryParams(Request $request): array
    {
        return array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function projectOptionsPayload(): array
    {
        return ProjectSelection::familyFilterOptions()
            ->map(function (array $option) {
                $projectIds = collect($option['project_ids'] ?? [])
                    ->map(fn ($projectId) => (int) $projectId)
                    ->filter(fn (int $projectId) => $projectId > 0)
                    ->values()
                    ->all();

                return [
                    'id' => (int) ($option['id'] ?? 0),
                    'name' => (string) ($option['name'] ?? ''),
                    'label' => (string) ($option['name'] ?? ''),
                    'project_ids' => $projectIds,
                ];
            })
            ->filter(fn (array $option) => $option['id'] > 0 && $option['name'] !== '')
            ->values()
            ->all();
    }

    private function resolveClientProjectId(int $selectedProjectId): ?int
    {
        if ($selectedProjectId <= 0) {
            return null;
        }

        $familyIds = ProjectSelection::familyIdsFor($selectedProjectId);
        if (empty($familyIds)) {
            return $selectedProjectId;
        }

        $constructionPhase = strtolower(Project::PHASE_CONSTRUCTION);
        $completedPhase = strtolower(Project::PHASE_COMPLETED);
        $designPhase = strtolower(Project::PHASE_DESIGN);

        $resolved = Project::query()
            ->whereIn('id', $familyIds)
            ->orderByRaw("
                CASE
                    WHEN LOWER(TRIM(COALESCE(phase, ''))) = '{$constructionPhase}' THEN 0
                    WHEN LOWER(TRIM(COALESCE(phase, ''))) = '{$completedPhase}' THEN 1
                    WHEN LOWER(TRIM(COALESCE(phase, ''))) = '{$designPhase}' THEN 2
                    ELSE 3
                END
            ")
            ->orderByDesc('updated_at')
            ->first(['id']);

        return $resolved?->id ? (int) $resolved->id : $selectedProjectId;
    }
}
