<?php

namespace App\Services;

use App\Models\DesignProject;
use App\Models\Project;
use App\Models\User;
use App\Support\Projects\ProjectFlow;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DesignerDashboardService
{
    public function ensureAuthorized(User $user): void
    {
        abort_unless($user->role === User::ROLE_DESIGNER, 403);
    }

    public function indexPayload(Request $request, User $designer): array
    {
        $search = trim((string) $request->query('search', ''));
        $rows = $this->assignedDesignProjects($designer);

        if ($search !== '') {
            $needle = Str::lower($search);
            $rows = $rows
                ->filter(function (array $row) use ($needle) {
                    $haystacks = [
                        $row['name'] ?? '',
                        $row['client'] ?? '',
                        $row['location'] ?? '',
                        $row['status'] ?? '',
                    ];

                    return collect($haystacks)
                        ->contains(fn ($value) => str_contains(Str::lower((string) $value), $needle));
                })
                ->values();
        }

        return [
            'projects' => $rows->values()->all(),
            'filters' => [
                'search' => $search,
            ],
        ];
    }

    public function updateTracking(Project $project, User $designer, array $validated): void
    {
        if (ProjectFlow::normalizePhase((string) $project->phase) !== Project::PHASE_DESIGN) {
            throw ValidationException::withMessages([
                'project' => 'Only Design phase projects can be tracked here.',
            ]);
        }

        if (!$this->isAssignedDesigner($project, $designer)) {
            throw ValidationException::withMessages([
                'project' => 'You are not assigned as designer for this project.',
            ]);
        }

        $design = DesignProject::query()->firstOrCreate(
            ['project_id' => (int) $project->id],
            [
                'design_contract_amount' => 0,
                'downpayment' => 0,
                'total_received' => 0,
                'office_payroll_deduction' => 0,
                'design_progress' => 0,
                'client_approval_status' => DesignProject::CLIENT_APPROVAL_PENDING,
                'work_started_at' => null,
                'work_completed_at' => null,
            ]
        );

        if (array_key_exists('work_started_at', $validated)) {
            $design->work_started_at = blank($validated['work_started_at']) ? null : $validated['work_started_at'];
        }

        if (array_key_exists('work_completed_at', $validated)) {
            $design->work_completed_at = blank($validated['work_completed_at']) ? null : $validated['work_completed_at'];
        }

        $started = $design->work_started_at ? Carbon::parse((string) $design->work_started_at)->startOfDay() : null;
        $completed = $design->work_completed_at ? Carbon::parse((string) $design->work_completed_at)->startOfDay() : null;

        if ($completed && !$started) {
            throw ValidationException::withMessages([
                'work_completed_at' => 'Start date is required before setting a completed date.',
            ]);
        }

        if ($started && $completed && $completed->lt($started)) {
            throw ValidationException::withMessages([
                'work_completed_at' => 'Completed date cannot be earlier than start date.',
            ]);
        }

        $design->save();
    }

    private function assignedDesignProjects(User $designer): Collection
    {
        return Project::query()
            ->whereRaw('LOWER(TRIM(COALESCE(phase, \'\'))) = ?', [Str::lower(Project::PHASE_DESIGN)])
            ->with(['designTracker:id,project_id,design_progress,work_started_at,work_completed_at'])
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->get()
            ->filter(fn (Project $project) => $this->isAssignedDesigner($project, $designer))
            ->map(fn (Project $project) => $this->projectPayload($project))
            ->values();
    }

    private function isAssignedDesigner(Project $project, User $designer): bool
    {
        $designerName = $this->normalizeName($designer->fullname);
        if ($designerName === '') {
            return false;
        }

        return collect(ProjectFlow::assignedRoleEntries($project->assigned_role))
            ->contains(function (array $entry) use ($designerName) {
                $role = Str::lower(trim((string) ($entry['role'] ?? '')));
                $name = $this->normalizeName($entry['name'] ?? '');

                return $role === Str::lower(Project::ASSIGNED_ROLE_DESIGNER)
                    && $name !== ''
                    && $name === $designerName;
            });
    }

    private function normalizeName(?string $name): string
    {
        $trimmed = trim((string) $name);
        if ($trimmed === '') {
            return '';
        }

        return Str::lower(preg_replace('/\s+/', ' ', $trimmed));
    }

    private function projectPayload(Project $project): array
    {
        $design = $project->designTracker;
        $started = optional($design?->work_started_at)?->toDateString();
        $completed = optional($design?->work_completed_at)?->toDateString();
        $today = Carbon::today();
        $startedCarbon = $started ? Carbon::parse($started)->startOfDay() : null;
        $completedCarbon = $completed ? Carbon::parse($completed)->startOfDay() : null;

        $completedDays = null;
        $ongoingDays = null;

        if ($startedCarbon && $completedCarbon && !$completedCarbon->lt($startedCarbon)) {
            $completedDays = $startedCarbon->diffInDays($completedCarbon) + 1;
        } elseif ($startedCarbon) {
            $ongoingDays = $startedCarbon->diffInDays($today) + 1;
        }

        return [
            'id' => (int) $project->id,
            'name' => (string) $project->name,
            'client' => (string) ($project->client ?? ''),
            'location' => (string) ($project->location ?? ''),
            'status' => (string) ($project->status ?? ''),
            'phase' => ProjectFlow::normalizePhase((string) $project->phase),
            'target' => optional($project->target)?->toDateString(),
            'assigned_role' => (string) ($project->assigned_role ?? ''),
            'design_progress' => (int) ($design?->design_progress ?? 0),
            'work_started_at' => $started,
            'work_completed_at' => $completed,
            'completed_days' => $completedDays,
            'ongoing_days' => $ongoingDays,
        ];
    }
}
