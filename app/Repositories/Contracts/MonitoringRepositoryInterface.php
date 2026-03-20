<?php

namespace App\Repositories\Contracts;

use App\Models\Project;
use App\Models\ProjectScope;
use Illuminate\Support\Collection;

interface MonitoringRepositoryInterface
{
    public function scopesWithPhotos(Project $project): Collection;

    public function createScope(Project $project, array $attributes): void;

    public function updateScope(ProjectScope $scope, array $attributes): void;

    public function deleteScope(ProjectScope $scope): void;

    public function latestWeeklyWeekStart(int $projectId): ?string;

    public function averageWeeklyProgress(int $projectId, string $weekStart): float;

    public function averageScopeProgress(Project $project): float;

    public function updateWeeklyProgressForScope(int $projectId, string $scopeName, float $progressPercent, string $weekStart): void;

    public function saveProjectOverallProgress(Project $project, int $overallProgress): void;

    public function assignedForemanIdsForProject(int $projectId): Collection;

    public function foremenByIds(array $ids): Collection;

    public function allForemen(): Collection;
}
