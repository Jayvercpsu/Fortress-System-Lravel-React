<?php

namespace App\Repositories\Contracts;

use App\Models\DesignProject;
use App\Models\Project;

interface DesignRepositoryInterface
{
    public function firstOrCreateByProjectId(string $projectId): DesignProject;

    public function updateOrCreateByProjectId(string $projectId, array $attributes): void;

    public function findProjectById(string $projectId): ?Project;
}
