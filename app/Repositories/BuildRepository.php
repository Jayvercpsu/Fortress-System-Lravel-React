<?php

namespace App\Repositories;

use App\Models\BuildProject;
use App\Models\Expense;
use App\Models\Material;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;
use App\Repositories\Contracts\BuildRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class BuildRepository implements BuildRepositoryInterface
{
    public function findProjectOrFail(string $projectId): Project
    {
        return Project::query()->findOrFail($projectId);
    }

    public function firstOrCreateBuildByProjectId(string $projectId): BuildProject
    {
        return BuildProject::query()->firstOrCreate(
            ['project_id' => $projectId],
            [
                'construction_contract' => 0,
                'total_client_payment' => 0,
                'materials_cost' => 0,
                'labor_cost' => 0,
                'equipment_cost' => 0,
            ]
        );
    }

    public function expenseTotal(string $projectId): float
    {
        return (float) Expense::query()
            ->where('project_id', $projectId)
            ->sum('amount');
    }

    public function expenseCategoryTotals(string $projectId): Collection
    {
        return Expense::query()
            ->where('project_id', $projectId)
            ->get(['category', 'amount'])
            ->groupBy(fn (Expense $expense) => trim((string) ($expense->category ?: Expense::CATEGORY_UNCATEGORIZED_KEY)) ?: Expense::CATEGORY_UNCATEGORIZED_KEY)
            ->map(fn ($group, $category) => [
                'category' => $category,
                'amount' => (float) $group->sum('amount'),
            ])
            ->sortByDesc('amount')
            ->values();
    }

    public function materialOptions(): array
    {
        if (!Schema::hasTable('materials')) {
            return [];
        }

        return Material::query()
            ->orderBy('name')
            ->pluck('name')
            ->filter(fn ($name) => trim((string) $name) !== '')
            ->values()
            ->all();
    }

    public function paginatedExpenses(string $projectId, string $search, int $perPage): LengthAwarePaginator
    {
        $query = Expense::query()->where('project_id', $projectId);

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('category', 'like', "%{$search}%")
                    ->orWhere('note', 'like', "%{$search}%")
                    ->orWhere('date', 'like', "%{$search}%");
            });
        }

        return $query
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->paginate($perPage, ['id', 'project_id', 'category', 'amount', 'note', 'date'], 'expense_page')
            ->withQueryString();
    }

    public function scopesWithPhotos(Project $project): Collection
    {
        return $project->scopes()
            ->with(['photos' => fn ($query) => $query->latest('id')])
            ->latest('id')
            ->get();
    }

    public function insertDefaultScopes(Project $project, array $scopeNames): void
    {
        $now = now();
        $project->scopes()->insert(
            collect($scopeNames)->map(function (string $name) use ($project, $now) {
                return [
                    'project_id' => (int) $project->id,
                    'scope_name' => $name,
                    'assigned_personnel' => null,
                    'progress_percent' => 0,
                    'status' => ProjectScope::STATUS_NOT_STARTED,
                    'remarks' => null,
                    'contract_amount' => 0,
                    'weight_percent' => 0,
                    'start_date' => null,
                    'target_completion' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })->all()
        );
    }

    public function projectForemanOptions(Project $project): array
    {
        $assignedForemanIds = ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->when(
                $assignedForemanIds->isNotEmpty(),
                fn ($query) => $query->whereIn('id', $assignedForemanIds->all()),
                fn ($query) => $query->whereRaw('1 = 0')
            )
            ->orderBy('fullname')
            ->get(['id', 'fullname'])
            ->map(fn (User $user) => [
                'id' => (int) $user->id,
                'fullname' => trim((string) ($user->fullname ?? '')),
            ])
            ->filter(fn (array $row) => $row['fullname'] !== '')
            ->values()
            ->all();
    }

    public function updateOrCreateBuildByProjectId(string $projectId, array $attributes): void
    {
        BuildProject::query()->updateOrCreate(
            ['project_id' => $projectId],
            $attributes
        );
    }

    public function findBuildByProjectId(string $projectId): ?BuildProject
    {
        return BuildProject::query()
            ->where('project_id', $projectId)
            ->first();
    }
}
