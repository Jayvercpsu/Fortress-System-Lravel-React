<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\User;
use App\Repositories\Contracts\ProjectFileRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class ProjectFileService
{
    public function __construct(
        private readonly ProjectFileRepositoryInterface $projectFileRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function filesPayload(Project $project): array
    {
        return [
            'files' => $this->projectFileRepository->listForProject($project),
        ];
    }

    public function createFile(Project $project, UploadedFile $file, int $userId): void
    {
        $this->projectFileRepository->createForProject($project, $file, $userId);
    }

    public function deleteFile(ProjectFile $projectFile): void
    {
        $this->projectFileRepository->deleteProjectFile($projectFile);
    }

    public function projectShowQueryParams(Request $request): array
    {
        return array_filter([
            'tab' => $request->query('tab'),
            'files_search' => $request->query('files_search'),
            'files_per_page' => $request->query('files_per_page'),
            'files_page' => $request->query('files_page'),
            'updates_search' => $request->query('updates_search'),
            'updates_per_page' => $request->query('updates_per_page'),
            'updates_page' => $request->query('updates_page'),
        ], fn ($value) => $value !== null && $value !== '');
    }
}
