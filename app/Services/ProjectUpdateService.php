<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Repositories\Contracts\ProjectUpdateRepositoryInterface;
use Illuminate\Http\Request;

class ProjectUpdateService
{
    public function __construct(
        private readonly ProjectUpdateRepositoryInterface $projectUpdateRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function updatesPayload(Project $project): array
    {
        return [
            'updates' => $this->projectUpdateRepository->listForProject($project),
        ];
    }

    public function createUpdate(Project $project, int $userId, string $note): void
    {
        $this->projectUpdateRepository->createForProject($project, $userId, $note);
    }

    public function deleteUpdate(ProjectUpdate $projectUpdate): void
    {
        $this->projectUpdateRepository->deleteProjectUpdate($projectUpdate);
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
