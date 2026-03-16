<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\User;
use App\Support\ProjectSelection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $allowedPerPage = [5, 10, 25, 50];
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);

        if (!in_array($perPage, $allowedPerPage, true)) {
            $perPage = 10;
        }

        $query = User::query()
            ->where('role', 'client')
            ->with('detail');

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('fullname', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%")
                    ->orWhereHas('detail', function ($detailQuery) use ($search) {
                        $detailQuery
                            ->where('phone', 'like', "%{$search}%")
                            ->orWhere('address', 'like', "%{$search}%");
                    })
                    ->orWhereHas('projectAssignments', function ($assignmentQuery) use ($search) {
                        $assignmentQuery
                            ->where('role_in_project', 'client')
                            ->whereHas('project', fn ($projectQuery) => $projectQuery->where('name', 'like', "%{$search}%"));
                    });
            });
        }

        $paginator = $query
            ->latest()
            ->paginate($perPage)
            ->withQueryString();

        $users = collect($paginator->items());
        $clientIds = $users->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        $assignments = collect();
        if ($clientIds->isNotEmpty()) {
            $assignments = ProjectAssignment::query()
                ->with('project:id,name')
                ->whereIn('user_id', $clientIds->all())
                ->where('role_in_project', 'client')
                ->latest('id')
                ->get()
                ->groupBy('user_id')
                ->map(fn ($rows) => $rows->first());
        }

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

        return Inertia::render('HeadAdmin/Clients/Index', [
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
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'client_name' => ['required', 'string', 'max:255'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'location' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:50'],
            'username' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9._-]+$/', 'unique:users,username'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $email = $validated['email'] ?? null;
        $phone = $validated['phone'] ?? null;

        $assignmentProjectId = null;
        if (!empty($validated['project_id'])) {
            $assignmentProjectId = $this->resolveClientProjectId((int) $validated['project_id']);
        }

        $client = User::create([
            'fullname' => $validated['client_name'],
            'email' => $email,
            'username' => $validated['username'],
            'password' => Hash::make($validated['password']),
            'role' => 'client',
        ]);

        $client->detail()->create([
            'phone' => $phone,
            'address' => $validated['location'] ?? null,
        ]);

        if ($assignmentProjectId !== null) {
            ProjectAssignment::query()->updateOrCreate(
                [
                    'project_id' => $assignmentProjectId,
                    'user_id' => $client->id,
                ],
                [
                    'role_in_project' => 'client',
                ]
            );
        }

        return redirect()
            ->route('clients.index')
            ->with('success', 'Client created successfully.');
    }

    public function update(Request $request, User $user)
    {
        abort_unless($user->role === 'client', 403);

        $validated = $request->validate([
            'client_name' => ['required', 'string', 'max:255'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'location' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'phone' => ['nullable', 'string', 'max:50'],
            'username' => ['required', 'string', 'max:80', 'regex:/^[A-Za-z0-9._-]+$/', 'unique:users,username,' . $user->id],
            'password' => ['nullable', 'string', 'min:6', 'confirmed'],
        ]);

        $email = $validated['email'] ?? null;
        $phone = $validated['phone'] ?? null;

        $user->update([
            'fullname' => $validated['client_name'],
            'email' => $email,
            'username' => $validated['username'],
        ]);

        if (!empty($validated['password'])) {
            $user->update(['password' => Hash::make($validated['password'])]);
        }

        $user->detail()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'phone' => $phone,
                'address' => $validated['location'] ?? null,
            ]
        );

        $assignmentProjectId = null;
        if (!empty($validated['project_id'])) {
            $assignmentProjectId = $this->resolveClientProjectId((int) $validated['project_id']);
        }

        if ($assignmentProjectId) {
            ProjectAssignment::query()->updateOrCreate(
                [
                    'project_id' => $assignmentProjectId,
                    'user_id' => $user->id,
                ],
                [
                    'role_in_project' => 'client',
                ]
            );

            ProjectAssignment::query()
                ->where('user_id', $user->id)
                ->where('role_in_project', 'client')
                ->where('project_id', '!=', $assignmentProjectId)
                ->delete();
        } else {
            ProjectAssignment::query()
                ->where('user_id', $user->id)
                ->where('role_in_project', 'client')
                ->delete();
        }

        $query = array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');

        return redirect()
            ->route('clients.index', $query)
            ->with('success', 'Client updated successfully.');
    }

    public function destroy(Request $request, User $user)
    {
        abort_unless($user->role === 'client', 403);

        $user->delete();

        $query = array_filter([
            'search' => $request->query('search'),
            'per_page' => $request->query('per_page'),
            'page' => $request->query('page'),
        ], fn ($value) => $value !== null && $value !== '');

        return redirect()
            ->route('clients.index', $query)
            ->with('success', 'Client deleted successfully.');
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

        $resolved = Project::query()
            ->whereIn('id', $familyIds)
            ->orderByRaw("
                CASE
                    WHEN LOWER(TRIM(COALESCE(phase, ''))) = 'construction' THEN 0
                    WHEN LOWER(TRIM(COALESCE(phase, ''))) = 'completed' THEN 1
                    WHEN LOWER(TRIM(COALESCE(phase, ''))) = 'design' THEN 2
                    ELSE 3
                END
            ")
            ->orderByDesc('updated_at')
            ->first(['id']);

        return $resolved?->id ? (int) $resolved->id : $selectedProjectId;
    }
}
