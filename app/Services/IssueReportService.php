<?php

namespace App\Services;

use App\Models\IssueReport;
use App\Models\User;
use App\Repositories\Contracts\IssueReportRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class IssueReportService
{
    private const ALLOWED_PER_PAGE = [5, 10, 25, 50];

    public function __construct(
        private readonly IssueReportRepositoryInterface $issueReportRepository
    ) {
    }

    public function ensureAuthorized(User $user): void
    {
        abort_unless(in_array($user->role, User::manageableRoles(), true), 403);
    }

    public function indexPayload(Request $request): array
    {
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 10);
        $status = trim((string) $request->query('status', ''));

        if (!in_array($perPage, self::ALLOWED_PER_PAGE, true)) {
            $perPage = 10;
        }

        $projects = collect();
        $showEmptyProjects = $search === '' && $status === '';

        if ($showEmptyProjects) {
            $paginator = $this->issueReportRepository->paginateNonDesignProjects($perPage);

            $projectIds = collect($paginator->items())
                ->map(fn ($item) => $item->id ?? null)
                ->values()
                ->unique()
                ->all();

            $projects = collect($paginator->items())
                ->map(fn ($project) => [
                    'id' => $project->id,
                    'name' => $project->name,
                ])
                ->values();
        } else {
            $paginator = $this->issueReportRepository->paginateIssueProjectIds($search, $status, $perPage);
            $projectIds = collect($paginator->items())
                ->map(fn ($item) => $item->project_id ?? null)
                ->values()
                ->unique()
                ->all();
        }

        $issues = $this->issueReportRepository->listIssuesByProjectIds($projectIds, $search, $status)
            ?? collect();

        if (!$issues instanceof Collection) {
            $issues = collect($issues);
        }

        $issues = $issues
            ->sortBy(function (IssueReport $row) use ($projectIds) {
                $targetKey = $row->project_id === null ? '__null__' : (string) $row->project_id;
                foreach ($projectIds as $index => $projectId) {
                    $currentKey = $projectId === null ? '__null__' : (string) $projectId;
                    if ($currentKey === $targetKey) {
                        return $index;
                    }
                }

                return PHP_INT_MAX;
            })
            ->values()
            ->map(fn (IssueReport $row) => [
                'id' => $row->id,
                'project_id' => $row->project_id,
                'project_name' => $row->project?->name,
                'foreman_name' => $row->foreman?->fullname ?? 'Unknown',
                'issue_title' => $row->issue_title,
                'description' => $row->description,
                'severity' => $row->severity,
                'status' => $row->status,
                'photo_path' => $row->photo_path,
                'created_at' => optional($row->created_at)?->toDateTimeString(),
            ])
            ->values();

        $page = $request->user()->role === User::ROLE_HEAD_ADMIN
            ? 'HeadAdmin/Issues/Index'
            : 'Admin/Issues/Index';

        return [
            'page' => $page,
            'props' => [
                'issues' => $issues,
                'projects' => $projects,
                'issueTable' => $this->tableMeta($paginator, $search, $status),
                'statusFilters' => IssueReport::statusOptions(),
                'selectedStatus' => $status,
            ],
        ];
    }

    public function updateStatus(IssueReport $issueReport, string $status): string
    {
        if ((string) $issueReport->status === $status) {
            return __('messages.issues.status_already', ['status' => $status]);
        }

        $this->issueReportRepository->updateStatus($issueReport, $status);

        return __('messages.issues.status_marked', ['status' => $status]);
    }

    private function tableMeta($paginator, string $search, string $status = ''): array
    {
        return [
            'search' => $search,
            'per_page' => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page' => max(1, $paginator->lastPage()),
            'total' => $paginator->total(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
            'status' => $status,
        ];
    }
}
