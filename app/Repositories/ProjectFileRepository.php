<?php

namespace App\Repositories;

use App\Models\Project;
use App\Models\ProjectFile;
use App\Repositories\Contracts\ProjectFileRepositoryInterface;
use App\Support\Uploads\UploadManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;

class ProjectFileRepository implements ProjectFileRepositoryInterface
{
    public function listForProject(Project $project): Collection
    {
        return $project->files()->latest()->get();
    }

    public function createForProject(Project $project, UploadedFile $file, int $userId): void
    {
        $path = UploadManager::store($file, 'project-files/' . $project->id);

        ProjectFile::query()->create([
            'project_id' => $project->id,
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'uploaded_by' => $userId,
        ]);
    }

    public function deleteProjectFile(ProjectFile $projectFile): void
    {
        UploadManager::delete($projectFile->file_path);
        $projectFile->delete();
    }
}
