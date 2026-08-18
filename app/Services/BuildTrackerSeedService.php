<?php

namespace App\Services;

use App\Models\BuildProject;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\User;

/**
 * Seeds (and resets) the Build Tracker for any project: Construction Contract,
 * Total Client Payment and the Scope of Works, with all scope computations
 * (per-scope WT %, accomplished amount, overall weighted progress) derived here
 * rather than hardcoded.
 *
 * Used by both the `fortress:seed-build-tracker` artisan command (dynamic
 * project id) and the project-specific seed migration.
 */
class BuildTrackerSeedService
{
    public const DEFAULT_CONSTRUCTION_CONTRACT = 830000.00;

    public const DEFAULT_TOTAL_CLIENT_PAYMENT = 700000.00;

    /**
     * Weight percentage per Scope of Works name. Intended to sum to 100.00;
     * balancedScopeWeights() guarantees the total is exactly 100.00 even if
     * this list is edited and drifts. Contract amounts are derived from the
     * (balanced) weights × the contract amount.
     */
    private const SCOPE_WEIGHTS = [
        'Mobilization and Hauling' => 4.00,
        'Foundation Preparation' => 5.00,
        'Column Footing' => 4.00,
        'Column' => 7.00,
        'Footing / Tie Beam' => 5.00,
        'Second Floor Beam, Slab, and Stairs' => 8.00,
        'Slab on Fill' => 3.00,
        'CHB Laying with Plastering' => 9.00,
        'Garage Flooring' => 3.00,
        'Roof Beam' => 4.00,
        'Roofing and Tinsmithry' => 6.00,
        'Ceiling Works' => 3.00,
        'Metal Works' => 3.00,
        'Doors and Jambs' => 2.00,
        'Wooden Planks (Steps)' => 1.00,
        'Doors and Windows' => 3.00,
        'Tile Works (Floor)' => 3.00,
        'Bathroom Wall and Floor Tiles' => 3.00,
        'Kitchen Counter Cabinet' => 2.00,
        'Electrical Works' => 5.00,
        'Plumbing Works' => 4.00,
        'Plumbing Fixtures' => 2.00,
        'Catch Basin (with inside plastering)' => 1.00,
        'Painting Works' => 3.00,
        'Wall (Colored)' => 2.00,
        'Interior Ceiling & Ceiling Eaves' => 2.00,
        'Doors and Stairs' => 1.00,
        'Outdoor Fluted Panel' => 2.00,
    ];

    /**
     * Progress % per Scope of Works name (0-100). Status is derived from this.
     */
    private const SCOPE_PROGRESS = [
        'Mobilization and Hauling' => 100,
        'Foundation Preparation' => 100,
        'Column Footing' => 100,
        'Column' => 85,
        'Footing / Tie Beam' => 80,
        'Second Floor Beam, Slab, and Stairs' => 55,
        'Slab on Fill' => 50,
        'CHB Laying with Plastering' => 40,
        'Garage Flooring' => 25,
        'Roof Beam' => 20,
        'Roofing and Tinsmithry' => 15,
        'Ceiling Works' => 10,
        'Metal Works' => 10,
        'Doors and Jambs' => 5,
        'Wooden Planks (Steps)' => 0,
        'Doors and Windows' => 5,
        'Tile Works (Floor)' => 0,
        'Bathroom Wall and Floor Tiles' => 0,
        'Kitchen Counter Cabinet' => 0,
        'Electrical Works' => 15,
        'Plumbing Works' => 10,
        'Plumbing Fixtures' => 0,
        'Catch Basin (with inside plastering)' => 20,
        'Painting Works' => 0,
        'Wall (Colored)' => 0,
        'Interior Ceiling & Ceiling Eaves' => 0,
        'Doors and Stairs' => 0,
        'Outdoor Fluted Panel' => 0,
    ];

    /**
     * Remarks per Scope of Works name.
     */
    private const SCOPE_REMARKS = [
        'Mobilization and Hauling' => 'Mobilization complete; site cleared and materials hauled in.',
        'Foundation Preparation' => 'Excavation and soil compaction finished; ready for footings.',
        'Column Footing' => 'Footing excavation, rebar, and concrete pour completed.',
        'Column' => 'Ground floor columns formed and poured; curing ongoing.',
        'Footing / Tie Beam' => 'Tie beams complete; backfill and compaction done.',
        'Second Floor Beam, Slab, and Stairs' => 'Second floor forms are staged; rebar in progress.',
        'Slab on Fill' => 'Slab on fill placed and finished on the ground floor area.',
        'CHB Laying with Plastering' => 'Ground floor walling complete; second floor ongoing.',
        'Garage Flooring' => 'Garage slab preparation started.',
        'Roof Beam' => 'Roof beam forms and rebar partially in place.',
        'Roofing and Tinsmithry' => 'Roof framing up; sheet installation queued.',
        'Ceiling Works' => 'Ceiling furring underway on the ground floor.',
        'Metal Works' => 'Steel railings and metal frames fabrication in progress.',
        'Doors and Jambs' => 'Door jambs installed on the ground floor.',
        'Wooden Planks (Steps)' => 'Not started — stairs scheduled after slab work.',
        'Doors and Windows' => 'Aluminum window frames delivered; installation pending.',
        'Tile Works (Floor)' => 'Not started — flooring after wall plastering cures.',
        'Bathroom Wall and Floor Tiles' => 'Not started — pending plumbing rough-in completion.',
        'Kitchen Counter Cabinet' => 'Not started — counter fabrication queued.',
        'Electrical Works' => 'Conduit and wiring rough-in ongoing; panel schedule approved.',
        'Plumbing Works' => 'Water and drainage lines partially installed.',
        'Plumbing Fixtures' => 'Not started — fixtures after wall and floor finishing.',
        'Catch Basin (with inside plastering)' => 'Catch basin excavated; plastering in progress.',
        'Painting Works' => 'Not started — pending plaster and skim coat.',
        'Wall (Colored)' => 'Not started — color coat after base painting.',
        'Interior Ceiling & Ceiling Eaves' => 'Not started — ceiling board installation pending.',
        'Doors and Stairs' => 'Not started — stair fabrication in progress at shop.',
        'Outdoor Fluted Panel' => 'Not started — panels on order.',
    ];

    /**
     * Seed the Build Tracker for one project.
     *
     * @param  int  $projectId  Target project id.
     * @param  float|null  $contract  Construction Contract; falls back to the
     *                                project's current construction_cost, then to
     *                                DEFAULT_CONSTRUCTION_CONTRACT.
     * @param  float|null  $payment  Total Client Payment; falls back to the
     *                               project's current total_client_payment, then
     *                               to DEFAULT_TOTAL_CLIENT_PAYMENT.
     * @return array{seeded: bool, ...} Summary result for console reporting.
     */
    public function seed(int $projectId, ?float $contract = null, ?float $payment = null): array
    {
        $project = Project::withTrashed()->find($projectId);
        if (! $project) {
            return ['seeded' => false, 'project_id' => $projectId];
        }

        $contractAmount = $contract ?? (float) ($project->construction_cost ?? 0);
        if ($contractAmount <= 0) {
            $contractAmount = self::DEFAULT_CONSTRUCTION_CONTRACT;
        }

        $paymentAmount = $payment ?? (float) ($project->total_client_payment ?? 0);
        if ($paymentAmount <= 0) {
            $paymentAmount = self::DEFAULT_TOTAL_CLIENT_PAYMENT;
        }

        // 1. Construction Contract + Total Client Payment (the Build Tracker
        //    reads these from the project row's financial fields).
        $project->update([
            'construction_cost' => $contractAmount,
            'total_client_payment' => $paymentAmount,
        ]);

        // 2. Mirror the same values on the build_projects tracker row.
        BuildProject::query()->updateOrCreate(
            ['project_id' => $projectId],
            [
                'construction_contract' => $contractAmount,
                'total_client_payment' => $paymentAmount,
            ]
        );

        // 3. Scope of Works: backfill amounts/weights/progress/assignee/remarks
        //    on the existing default scopes, deriving amounts from the weights.
        $scopeWeights = $this->balancedScopeWeights();
        $totalWeight = round(array_sum($scopeWeights), 2);
        $weightMismatch = abs($totalWeight - 100.0) > 0.001;
        $assignee = $this->resolveAssignee($project);

        $summaryRows = [];
        $weightedProgressTotal = 0.0;

        foreach ($scopeWeights as $scopeName => $weightPercent) {
            $progress = (int) (self::SCOPE_PROGRESS[$scopeName] ?? 0);

            // Scope computations — derived here, not hardcoded:
            $scopeContract = round($contractAmount * $weightPercent / 100, 2);
            $computedPercent = round($weightPercent * $progress / 100, 2);
            $accomplishedAmount = round($scopeContract * $progress / 100, 2);

            $updated = ProjectScope::query()
                ->where('project_id', $projectId)
                ->where('scope_name', $scopeName)
                ->update([
                    'contract_amount' => $scopeContract,
                    'weight_percent' => $weightPercent,
                    'progress_percent' => $progress,
                    'status' => ProjectScope::statusFromProgress($progress),
                    'assigned_personnel' => $assignee,
                    'remarks' => self::SCOPE_REMARKS[$scopeName] ?? null,
                ]);

            if ($updated > 0) {
                $weightedProgressTotal += $computedPercent;
                $summaryRows[] = [
                    'scope' => $scopeName,
                    'assigned' => (string) ($assignee ?? ''),
                    'contract_amount' => number_format($scopeContract, 2),
                    'weight_percent' => number_format($weightPercent, 2).'%',
                    'progress_percent' => $progress.'%',
                    'computed_percent' => number_format($computedPercent, 2).'%',
                    'accomplished_amount' => number_format($accomplishedAmount, 2),
                ];
            }
        }

        // 4. Overall weighted progress = Σ (weight × progress / 100), clamped
        //    0-100 and stored as an integer (matches the app-wide convention,
        //    e.g. WeeklyAccomplishmentObserver).
        $overallProgress = (int) round(max(0, min(100, $weightedProgressTotal)));
        $project->update(['overall_progress' => $overallProgress]);

        return [
            'seeded' => true,
            'project_id' => $projectId,
            'project_name' => (string) $project->name,
            'contract' => $contractAmount,
            'payment' => $paymentAmount,
            'payment_progress' => $contractAmount > 0
                ? round(($paymentAmount / $contractAmount) * 100, 2)
                : 0,
            'overall_progress' => $overallProgress,
            'total_weight' => $totalWeight,
            'weight_mismatch' => $weightMismatch,
            'rows' => $summaryRows,
        ];
    }

    /**
     * Restore the pre-seed defaults for a project (used by migration down()).
     */
    public function reset(int $projectId): bool
    {
        $project = Project::withTrashed()->find($projectId);
        if (! $project) {
            return false;
        }

        $project->update([
            'construction_cost' => 0,
            'total_client_payment' => 0,
            'overall_progress' => 0,
        ]);

        ProjectScope::query()
            ->where('project_id', $projectId)
            ->update([
                'contract_amount' => 0,
                'weight_percent' => 0,
                'progress_percent' => 0,
                'status' => ProjectScope::STATUS_NOT_STARTED,
                'assigned_personnel' => null,
                'remarks' => null,
            ]);

        BuildProject::query()
            ->where('project_id', $projectId)
            ->update([
                'construction_contract' => 0,
                'total_client_payment' => 0,
            ]);

        return true;
    }

    /**
     * Normalize the configured scope weights so they always total exactly
     * 100.00. Any rounding drift is absorbed into the largest scope, so the
     * remaining scopes keep their configured values unchanged.
     */
    private function balancedScopeWeights(): array
    {
        $weights = self::SCOPE_WEIGHTS;
        $total = round(array_sum($weights), 2);

        if (abs($total - 100.0) < 0.0001) {
            return $weights;
        }

        $largest = max($weights);
        $largestKey = (string) array_search($largest, $weights, true);
        $weights[$largestKey] = round($largest + (100.0 - $total), 2);

        return $weights;
    }

    private function resolveAssignee(Project $project): ?string
    {
        $assigned = trim((string) ($project->assigned ?? ''));
        if ($assigned !== '') {
            return $assigned;
        }

        $foremanIds = ProjectAssignment::query()
            ->where('project_id', $project->id)
            ->where('role_in_project', ProjectAssignment::ROLE_FOREMAN)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        if ($foremanIds->isEmpty()) {
            return null;
        }

        return User::query()
            ->where('role', User::ROLE_FOREMAN)
            ->whereIn('id', $foremanIds->all())
            ->orderBy('fullname')
            ->pluck('fullname')
            ->map(fn ($name) => trim((string) $name))
            ->filter(fn ($name) => $name !== '')
            ->unique(fn ($name) => mb_strtolower($name))
            ->values()
            ->implode(', ');
    }
}
