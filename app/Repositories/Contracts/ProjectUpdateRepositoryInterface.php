<?php

namespace App\Repositories\Contracts;

use App\Models\Project;
use App\Models\ProjectUpdate;
use Illuminate\Support\Collection;

interface ProjectUpdateRepositoryInterface
{
    public function listForProject(Project $project): Collection;

    public function createForProject(Project $project, int $userId, string $note): void;

    public function deleteProjectUpdate(ProjectUpdate $projectUpdate): void;
}
