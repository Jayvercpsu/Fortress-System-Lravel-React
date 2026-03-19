<?php

namespace App\Repositories;

use App\Models\Project;
use App\Models\ProjectUpdate;
use App\Repositories\Contracts\ProjectUpdateRepositoryInterface;
use Illuminate\Support\Collection;

class ProjectUpdateRepository implements ProjectUpdateRepositoryInterface
{
    public function listForProject(Project $project): Collection
    {
        return $project->updates()->latest()->get();
    }

    public function createForProject(Project $project, int $userId, string $note): void
    {
        ProjectUpdate::query()->create([
            'project_id' => $project->id,
            'note' => $note,
            'created_by' => $userId,
        ]);
    }

    public function deleteProjectUpdate(ProjectUpdate $projectUpdate): void
    {
        $projectUpdate->delete();
    }
}
