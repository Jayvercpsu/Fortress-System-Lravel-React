<?php

namespace App\Support;

use App\Models\Project;
use Illuminate\Support\Collection;

class ProjectSelection
{
    public static function familyFilterOptions(): Collection
    {
        $projects = Project::query()
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id', 'source_project_id', 'name', 'client', 'phase', 'status']);

        return self::buildFamilyOptions($projects);
    }

    public static function familyFilterOptionsForIds(iterable $projectIds): Collection
    {
        $ids = self::normalizeIds($projectIds);
        if ($ids->isEmpty()) {
            return collect();
        }

        $projects = Project::query()
            ->whereIn('id', $ids->all())
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id', 'source_project_id', 'name', 'client', 'phase', 'status']);

        return self::buildFamilyOptions($projects);
    }

    public static function actualOptionsForIds(iterable $projectIds): Collection
    {
        $ids = self::normalizeIds($projectIds);
        if ($ids->isEmpty()) {
            return collect();
        }

        return Project::query()
            ->whereIn('id', $ids->all())
            ->orderBy('name')
            ->orderBy('phase')
            ->orderBy('id')
            ->get(['id', 'source_project_id', 'name', 'client', 'phase', 'status'])
            ->map(fn (Project $project) => self::actualOption($project))
            ->values();
    }

    public static function familyIdsFor(?int $selectedProjectId): array
    {
        $selectedId = (int) $selectedProjectId;
        if ($selectedId <= 0) {
            return [];
        }

        $selectedProject = Project::query()
            ->whereKey($selectedId)
            ->first(['id', 'source_project_id']);

        $rootId = $selectedProject
            ? self::rootIdForProject($selectedProject)
            : $selectedId;

        return Project::query()
            ->where('id', $rootId)
            ->orWhere('source_project_id', $rootId)
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    public static function rootIdMapForIds(iterable $projectIds): array
    {
        $ids = self::normalizeIds($projectIds);
        if ($ids->isEmpty()) {
            return [];
        }

        return Project::query()
            ->whereIn('id', $ids->all())
            ->get(['id', 'source_project_id'])
            ->mapWithKeys(fn (Project $project) => [
                (int) $project->id => self::rootIdForProject($project),
            ])
            ->all();
    }

    private static function buildFamilyOptions(Collection $projects): Collection
    {
        return $projects
            ->groupBy(fn (Project $project) => self::rootIdForProject($project))
            ->map(function (Collection $family, int|string $rootId) {
                $reference = $family->first(fn (Project $project) => $project->source_project_id === null)
                    ?? $family->sortBy('id')->first();

                $name = trim((string) ($reference?->name ?? 'Project ' . $rootId));

                return [
                    'id' => (int) $rootId,
                    'name' => $name,
                    'label' => $name,
                    'client' => $reference?->client,
                    'phase' => $reference?->phase,
                    'status' => $reference?->status,
                    'project_ids' => $family->pluck('id')
                        ->map(fn ($id) => (int) $id)
                        ->unique()
                        ->values()
                        ->all(),
                ];
            })
            ->sort(function (array $left, array $right) {
                return [
                    mb_strtolower((string) ($left['name'] ?? '')),
                    (int) ($left['id'] ?? 0),
                ] <=> [
                    mb_strtolower((string) ($right['name'] ?? '')),
                    (int) ($right['id'] ?? 0),
                ];
            })
            ->values();
    }

    private static function actualOption(Project $project): array
    {
        $name = trim((string) ($project->name ?? ''));
        $phase = trim((string) ($project->phase ?? ''));

        return [
            'id' => (int) $project->id,
            'name' => $name,
            'label' => $phase !== '' ? "{$name} ({$phase})" : $name,
            'client' => $project->client,
            'phase' => $project->phase,
            'status' => $project->status,
            'source_project_id' => $project->source_project_id !== null ? (int) $project->source_project_id : null,
        ];
    }

    private static function rootIdForProject(Project $project): int
    {
        return (int) ($project->source_project_id ?: $project->id);
    }

    private static function normalizeIds(iterable $projectIds): Collection
    {
        return collect($projectIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();
    }
}
