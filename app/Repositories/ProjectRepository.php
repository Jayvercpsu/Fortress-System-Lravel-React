<?php

namespace App\Repositories;

use App\Enums\ProjectStatus;
use App\Models\Attendance;
use App\Models\BuildProject;
use App\Models\DeliveryConfirmation;
use App\Models\DesignProject;
use App\Models\Expense;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\Payment;
use App\Models\ProgressPhoto;
use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\ProjectWorker;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Models\Worker;
use App\Repositories\Contracts\ProjectRepositoryInterface;
use App\Support\Projects\ProjectFlow;
use App\Support\Uploads\UploadManager;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProjectRepository implements ProjectRepositoryInterface
{
    public function createProject(array $attributes): Project
    {
        return Project::query()->create($attributes);
    }

    public function updateProject(Project $project, array $attributes): void
    {
        $project->update($attributes);
    }

    public function hasTransferredProject(int $sourceProjectId): bool
    {
        return Project::withTrashed()
            ->where('source_project_id', $sourceProjectId)
            ->exists();
    }

    public function createConstructionDuplicate(Project $source): Project
    {
        return DB::transaction(function () use ($source) {
            $duplicate = Project::query()->create([
                'source_project_id' => $source->id,
                'name' => $source->name,
                'client' => $source->client,
                'type' => $source->type,
                'location' => $source->location,
                'assigned_role' => $source->assigned_role,
                'assigned' => $source->assigned,
                'target' => $source->target,
                'status' => ProjectStatus::PLANNING->value,
                'phase' => ProjectFlow::normalizePhase('Construction'),
                'overall_progress' => (int) ($source->overall_progress ?? 0),
                'contract_amount' => (float) ($source->contract_amount ?? 0),
                'design_fee' => (float) ($source->design_fee ?? 0),
                'construction_cost' => (float) ($source->construction_cost ?? 0),
                'total_client_payment' => (float) ($source->total_client_payment ?? 0),
                'remaining_balance' => (float) ($source->remaining_balance ?? 0),
                'last_paid_date' => $source->last_paid_date,
            ]);

            $sourceDesign = DesignProject::query()
                ->where('project_id', $source->id)
                ->first();

            if ($sourceDesign) {
                DesignProject::query()->updateOrCreate(
                    ['project_id' => $duplicate->id],
                    [
                        'design_contract_amount' => (float) ($sourceDesign->design_contract_amount ?? 0),
                        'downpayment' => (float) ($sourceDesign->downpayment ?? 0),
                        'total_received' => (float) ($sourceDesign->total_received ?? 0),
                        'office_payroll_deduction' => (float) ($sourceDesign->office_payroll_deduction ?? 0),
                        'design_progress' => (int) ($sourceDesign->design_progress ?? 0),
                        'client_approval_status' => (string) ($sourceDesign->client_approval_status ?? DesignProject::CLIENT_APPROVAL_PENDING),
                    ]
                );
            }

            BuildProject::query()->firstOrCreate(
                ['project_id' => $duplicate->id],
                [
                    'construction_contract' => 0,
                    'total_client_payment' => 0,
                    'materials_cost' => 0,
                    'labor_cost' => 0,
                    'equipment_cost' => 0,
                ]
            );

            ProjectAssignment::query()
                ->where('project_id', $source->id)
                ->get(['user_id', 'role_in_project'])
                ->each(function (ProjectAssignment $assignment) use ($duplicate) {
                    ProjectAssignment::query()->updateOrCreate(
                        [
                            'project_id' => $duplicate->id,
                            'user_id' => (int) $assignment->user_id,
                            'role_in_project' => (string) $assignment->role_in_project,
                        ],
                        []
                    );
                });

            Payment::query()
                ->where('project_id', $source->id)
                ->orderBy('id')
                ->get()
                ->each(function (Payment $payment) use ($duplicate) {
                    $clone = $payment->replicate(['project_id']);
                    $clone->project_id = $duplicate->id;
                    $clone->save();
                });

            return $duplicate;
        });
    }

    public function syncLegacyForemanAssignments(Project $project): void
    {
        $assignedNames = collect(preg_split('/[,;]+/', (string) ($project->assigned ?? '')))
            ->map(fn ($name) => trim((string) $name))
            ->filter()
            ->values();

        $foremanIds = User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->whereIn('fullname', $assignedNames->all())
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($assignedNames->isEmpty()) {
            ProjectAssignment::query()
                ->where('project_id', $project->id)
                ->whereIn('user_id', User::query()->where('role', User::ROLE_FOREMAN)->pluck('id'))
                ->delete();

            return;
        }

        $existingForemanIds = User::query()->where('role', User::ROLE_FOREMAN)->pluck('id');

        ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->whereIn('user_id', $existingForemanIds)
            ->whereNotIn('user_id', $foremanIds->all())
            ->delete();

        foreach ($foremanIds as $foremanId) {
            ProjectAssignment::query()->updateOrCreate(
                [
                    'project_id' => $project->id,
                    'user_id' => $foremanId,
                ],
                [
                    'role_in_project' => ProjectAssignment::ROLE_FOREMAN,
                ]
            );
        }
    }

    public function deleteProjectGraph(Project $project): void
    {
        $projectId = (int) $project->id;

        DB::transaction(function () use ($project, $projectId) {
            $scopeIds = ProjectScope::query()
                ->where('project_id', $projectId)
                ->pluck('id');
            $uploadedPaths = collect();

            if ($scopeIds->isNotEmpty()) {
                $uploadedPaths = $uploadedPaths->merge(
                    ScopePhoto::query()
                        ->whereIn('project_scope_id', $scopeIds->all())
                        ->pluck('photo_path')
                );
                ScopePhoto::query()->whereIn('project_scope_id', $scopeIds->all())->delete();
            }

            $uploadedPaths = $uploadedPaths
                ->merge(MaterialRequest::query()->where('project_id', $projectId)->pluck('photo_path'))
                ->merge(IssueReport::query()->where('project_id', $projectId)->pluck('photo_path'))
                ->merge(DeliveryConfirmation::query()->where('project_id', $projectId)->pluck('photo_path'))
                ->merge(ProgressPhoto::query()->where('project_id', $projectId)->pluck('photo_path'))
                ->merge($project->files()->pluck('file_path'));

            $uploadedPaths
                ->map(fn ($path) => trim((string) $path))
                ->filter(fn (string $path) => $path !== '')
                ->unique()
                ->each(fn (string $path) => UploadManager::delete($path));

            ProjectScope::query()->where('project_id', $projectId)->delete();
            ProgressSubmitToken::query()->where('project_id', $projectId)->delete();
            Payment::query()->where('project_id', $projectId)->delete();
            ProjectAssignment::query()->where('project_id', $projectId)->delete();
            ProjectWorker::query()->where('project_id', $projectId)->delete();
            Attendance::query()->where('project_id', $projectId)->delete();
            WeeklyAccomplishment::query()->where('project_id', $projectId)->delete();
            MaterialRequest::query()->where('project_id', $projectId)->delete();
            IssueReport::query()->where('project_id', $projectId)->delete();
            DeliveryConfirmation::query()->where('project_id', $projectId)->delete();
            ProgressPhoto::query()->where('project_id', $projectId)->delete();
            Worker::query()->where('project_id', $projectId)->delete();
            DesignProject::query()->where('project_id', $projectId)->delete();
            BuildProject::query()->where('project_id', $projectId)->delete();
            Expense::query()->where('project_id', $projectId)->delete();
            $project->files()->delete();
            $project->updates()->delete();
            $project->delete();
        });
    }

    public function latestForemanAssignmentUserId(Project $project): ?int
    {
        $assignment = $project->assignments()
            ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->latest('id')
            ->first(['user_id']);

        return $assignment?->user_id ? (int) $assignment->user_id : null;
    }

    public function latestForemanAssignmentUserIdByProjectId(int $projectId): ?int
    {
        $assignment = ProjectAssignment::query()
            ->where('project_id', $projectId)
            ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->latest('id')
            ->first(['user_id']);

        return $assignment?->user_id ? (int) $assignment->user_id : null;
    }

    public function findActiveProgressToken(int $projectId, int $foremanId): ?ProgressSubmitToken
    {
        return ProgressSubmitToken::query()
            ->where('project_id', $projectId)
            ->where('foreman_id', $foremanId)
            ->whereNull('revoked_at')
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->latest('id')
            ->first();
    }

    public function createProgressToken(int $projectId, int $foremanId): ProgressSubmitToken
    {
        return ProgressSubmitToken::query()->create([
            'project_id' => $projectId,
            'foreman_id' => $foremanId,
            'token' => Str::random(48),
            'expires_at' => now()->addDays(30),
        ]);
    }

    public function foremanOptions(): Collection
    {
        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->orderBy('fullname')
            ->get(['id', 'fullname']);
    }

    public function clientUsers(): Collection
    {
        return User::query()
            ->where('role', User::ROLE_CLIENT)
            ->orderBy('fullname')
            ->get(['id', 'fullname']);
    }

    public function latestClientAssignmentsByUserIds(array $userIds): Collection
    {
        if (empty($userIds)) {
            return collect();
        }

        return ProjectAssignment::query()
            ->with('project:id,name')
            ->whereIn('user_id', $userIds)
            ->where('role_in_project', ProjectAssignment::ROLE_CLIENT)
            ->latest('id')
            ->get()
            ->groupBy('user_id')
            ->map(fn ($rows) => $rows->first());
    }

    public function projectWorkersWithForeman(int $projectId): Collection
    {
        return Worker::query()
            ->where('project_id', $projectId)
            ->with('foreman:id,fullname')
            ->orderBy('name')
            ->orderBy('id')
            ->get();
    }

    public function projectTeamMembers(Project $project): Collection
    {
        return $project->teamMembers()
            ->with('user:id,fullname,role')
            ->orderByRaw('CASE WHEN user_id IS NULL THEN 1 ELSE 0 END')
            ->orderBy('worker_name')
            ->orderBy('id')
            ->get();
    }

    public function findDesignByProjectId(int $projectId): ?DesignProject
    {
        return DesignProject::query()
            ->where('project_id', $projectId)
            ->first();
    }

    public function findBuildByProjectId(int $projectId): ?BuildProject
    {
        return BuildProject::query()
            ->where('project_id', $projectId)
            ->first();
    }

    public function expenseTotalByProjectId(int $projectId): float
    {
        return (float) Expense::query()
            ->where('project_id', $projectId)
            ->sum('amount');
    }

    public function expenseCategoryTotalsByProjectId(int $projectId): array
    {
        return Expense::query()
            ->where('project_id', $projectId)
            ->select(DB::raw("COALESCE(NULLIF(TRIM(category), ''), '" . Expense::CATEGORY_UNCATEGORIZED . "') as category"), DB::raw('SUM(amount) as total'))
            ->groupBy('category')
            ->get()
            ->map(fn ($row) => [
                'category' => (string) $row->category,
                'amount' => (float) $row->total,
            ])
            ->values()
            ->all();
    }

    public function paymentTotalByProjectId(int $projectId): float
    {
        return (float) Payment::query()
            ->where('project_id', $projectId)
            ->sum('amount');
    }

    public function lastPaymentDateByProjectId(int $projectId): ?string
    {
        $lastPaidDate = Payment::query()
            ->where('project_id', $projectId)
            ->max('date_paid');

        return $lastPaidDate ? (string) $lastPaidDate : null;
    }

    public function transferredProjectsCount(int $projectId): int
    {
        return Project::query()
            ->where('source_project_id', $projectId)
            ->count();
    }

    public function persistDesignProgress(DesignProject $design, int $progress): void
    {
        $design->design_progress = $progress;
        $design->save();
    }
}
