<?php

namespace App\Services;

use App\Models\ProjectScope;
use App\Models\WeeklyAccomplishment;

/**
 * Single source of truth for PM progress.
 *
 * PM progress comes ONLY from independent PM accomplishment rows
 * (weekly_accomplishments with foreman_id NULL, submitted by a project
 * manager). Historical PM rows stored under a foreman_id are frozen and
 * ignored, and Foreman JotForm rows never contribute.
 *
 * The formula mirrors the /projects kanban so every consumer agrees:
 * SUM of ROUND(weight x percent / 100, 2) per scope, using the latest
 * PM percent per scope. Consumed by /projects cards, weekly
 * accomplishments (columns + overview), the progress receipt, the PM
 * portal, the PM mobile API, and the profitability reports.
 */
class PmProgressService
{
    /**
     * Latest PM percent per scope for one project, keyed by
     * lower-cased scope name.
     *
     * @return array<string, array{scope: string, percent: float}>
     */
    public function latestPercentsByProject(int $projectId): array
    {
        $rows = WeeklyAccomplishment::query()
            ->where('project_id', $projectId)
            ->whereNull('foreman_id')
            ->where('is_placeholder', false)
            ->orderBy('id')
            ->get(['scope_of_work', 'percent_completed']);

        $latest = [];
        foreach ($rows as $row) {
            $scope = trim((string) ($row->scope_of_work ?? ''));
            if ($scope === '') {
                continue;
            }
            $latest[strtolower($scope)] = [
                'scope' => $scope,
                'percent' => (float) ($row->percent_completed ?? 0),
            ];
        }

        return $latest;
    }

    /**
     * Planned scope weights for projects, keyed by project id then
     * lower-cased scope name.
     *
     * @return array<int, array<string, float>>
     */
    public function weightsByProjectIds(array $projectIds): array
    {
        $intIds = array_values(array_unique(array_map(
            static fn ($id) => (int) $id,
            array_filter($projectIds, fn ($id) => $id !== null && $id !== '')
        )));

        if ($intIds === []) {
            return [];
        }

        $rows = ProjectScope::query()
            ->whereIn('project_id', $intIds)
            ->whereRaw("TRIM(COALESCE(scope_name, '')) != ?", [''])
            ->get(['project_id', 'scope_name', 'weight_percent']);

        $map = [];
        foreach ($rows as $row) {
            $scopeKey = strtolower(trim((string) $row->scope_name));
            if ($scopeKey === '') {
                continue;
            }
            $projectKey = (int) $row->project_id;
            $map[$projectKey][$scopeKey] = ($map[$projectKey][$scopeKey] ?? 0.0)
                + (float) ($row->weight_percent ?? 0);
        }

        return $map;
    }

    /**
     * Weighted PM progress per project. Null when the PM side has no
     * independent rows for that project (caller decides the fallback —
     * cards show 0/Pending per the strictly-PM rule).
     *
     * @return array<int, float|null>
     */
    public function progressByProjectIds(array $projectIds): array
    {
        $intIds = array_values(array_unique(array_map(
            static fn ($id) => (int) $id,
            array_filter($projectIds, fn ($id) => $id !== null && $id !== '')
        )));

        $result = [];
        foreach ($intIds as $id) {
            $result[$id] = null;
        }

        if ($intIds === []) {
            return $result;
        }

        $weights = $this->weightsByProjectIds($intIds);

        $rows = WeeklyAccomplishment::query()
            ->whereIn('project_id', $intIds)
            ->whereNull('foreman_id')
            ->where('is_placeholder', false)
            ->orderBy('id')
            ->get(['project_id', 'scope_of_work', 'percent_completed']);

        $latestByProject = [];
        foreach ($rows as $row) {
            $scope = trim((string) ($row->scope_of_work ?? ''));
            if ($scope === '') {
                continue;
            }
            $latestByProject[(int) $row->project_id][strtolower($scope)] = (float) ($row->percent_completed ?? 0);
        }

        foreach ($intIds as $id) {
            $latest = $latestByProject[$id] ?? [];
            if ($latest === []) {
                continue;
            }
            $projectWeights = $weights[$id] ?? [];
            $total = 0.0;
            foreach ($latest as $scopeKey => $percent) {
                $weight = (float) ($projectWeights[$scopeKey] ?? 0);
                if ($weight == 0.0) {
                    continue;
                }
                $total += round($weight * $percent / 100, 2);
            }
            $result[$id] = round($total, 2);
        }

        return $result;
    }

    public function progressForProject(int $projectId): ?float
    {
        return $this->progressByProjectIds([$projectId])[$projectId] ?? null;
    }

    /**
     * PM-based earned amount per project: SUM of
     * ROUND(contract x min(100, percent) / 100, 2) per scope, using the
     * latest PM percent per scope — the same per-scope formula as the
     * progress receipt's amount_to_date. Scopes with no PM row contribute
     * 0. Projects with no PM rows at all are absent (caller defaults to 0).
     *
     * @return array<int, float>
     */
    public function accomplishedAmountsByProjectIds(array $projectIds): array
    {
        $intIds = array_values(array_unique(array_map(
            static fn ($id) => (int) $id,
            array_filter($projectIds, fn ($id) => $id !== null && $id !== '')
        )));

        if ($intIds === []) {
            return [];
        }

        $scopeRows = ProjectScope::query()
            ->whereIn('project_id', $intIds)
            ->whereRaw("TRIM(COALESCE(scope_name, '')) != ?", [''])
            ->get(['project_id', 'scope_name', 'contract_amount']);

        $contracts = [];
        foreach ($scopeRows as $row) {
            $scopeKey = strtolower(trim((string) $row->scope_name));
            if ($scopeKey === '') {
                continue;
            }
            $projectKey = (int) $row->project_id;
            $contracts[$projectKey][$scopeKey] = ($contracts[$projectKey][$scopeKey] ?? 0.0)
                + (float) ($row->contract_amount ?? 0);
        }

        $rows = WeeklyAccomplishment::query()
            ->whereIn('project_id', $intIds)
            ->whereNull('foreman_id')
            ->where('is_placeholder', false)
            ->orderBy('id')
            ->get(['project_id', 'scope_of_work', 'percent_completed']);

        $latestByProject = [];
        foreach ($rows as $row) {
            $scope = trim((string) ($row->scope_of_work ?? ''));
            if ($scope === '') {
                continue;
            }
            $latestByProject[(int) $row->project_id][strtolower($scope)] = (float) ($row->percent_completed ?? 0);
        }

        $result = [];
        foreach ($intIds as $id) {
            $latest = $latestByProject[$id] ?? [];
            if ($latest === []) {
                continue;
            }
            $projectContracts = $contracts[$id] ?? [];
            $total = 0.0;
            foreach ($latest as $scopeKey => $percent) {
                $contract = (float) ($projectContracts[$scopeKey] ?? 0);
                if ($contract == 0.0) {
                    continue;
                }
                $total += round($contract * min(100, $percent) / 100, 2);
            }
            $result[$id] = round($total, 2);
        }

        return $result;
    }
}
