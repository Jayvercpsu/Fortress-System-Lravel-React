<?php

namespace App\Repositories\Contracts;

use App\Models\Project;
use App\Models\ProjectFile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;

interface ProjectFileRepositoryInterface
{
    public function listForProject(Project $project): Collection;

    public function createForProject(Project $project, UploadedFile $file, int $userId): void;

    public function deleteProjectFile(ProjectFile $projectFile): void;
}
