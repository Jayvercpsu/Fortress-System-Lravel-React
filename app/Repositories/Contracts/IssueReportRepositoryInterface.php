<?php

namespace App\Repositories\Contracts;

use App\Models\IssueReport;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface IssueReportRepositoryInterface
{
    public function paginateNonDesignProjects(int $perPage): LengthAwarePaginator;

    public function paginateIssueProjectIds(string $search, string $status, int $perPage): LengthAwarePaginator;

    public function listIssuesByProjectIds(array $projectIds, string $search, string $status): Collection;

    public function updateStatus(IssueReport $issueReport, string $status): void;
}
