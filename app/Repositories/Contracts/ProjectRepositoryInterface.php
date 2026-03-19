<?php

namespace App\Repositories\Contracts;

use App\Models\BuildProject;
use App\Models\DesignProject;
use App\Models\ProgressSubmitToken;
use App\Models\Project;
use Illuminate\Support\Collection;

interface ProjectRepositoryInterface
{
    public function createProject(array $attributes): Project;

    public function updateProject(Project $project, array $attributes): void;

    public function hasTransferredProject(int $sourceProjectId): bool;

    public function createConstructionDuplicate(Project $source): Project;

    public function syncLegacyForemanAssignments(Project $project): void;

    public function deleteProjectGraph(Project $project): void;

    public function latestForemanAssignmentUserId(Project $project): ?int;

    public function latestForemanAssignmentUserIdByProjectId(int $projectId): ?int;

    public function findActiveProgressToken(int $projectId, int $foremanId): ?ProgressSubmitToken;

    public function createProgressToken(int $projectId, int $foremanId): ProgressSubmitToken;

    public function foremanOptions(): Collection;

    public function clientUsers(): Collection;

    public function latestClientAssignmentsByUserIds(array $userIds): Collection;

    public function projectWorkersWithForeman(int $projectId): Collection;

    public function projectTeamMembers(Project $project): Collection;

    public function findDesignByProjectId(int $projectId): ?DesignProject;

    public function findBuildByProjectId(int $projectId): ?BuildProject;

    public function expenseTotalByProjectId(int $projectId): float;

    /**
     * @return array<int, array{category: string, amount: float}>
     */
    public function expenseCategoryTotalsByProjectId(int $projectId): array;

    public function paymentTotalByProjectId(int $projectId): float;

    public function lastPaymentDateByProjectId(int $projectId): ?string;

    public function transferredProjectsCount(int $projectId): int;

    public function persistDesignProgress(DesignProject $design, int $progress): void;
}
