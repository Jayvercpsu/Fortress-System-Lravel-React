<?php

namespace App\Repositories\Contracts;

use Illuminate\Database\Eloquent\Builder;

interface KpiRepositoryInterface
{
    public function attendances(): Builder;

    public function weeklyAccomplishments(): Builder;

    public function issueReports(): Builder;

    public function materialRequests(): Builder;

    public function deliveries(): Builder;

    public function progressPhotos(): Builder;

    public function users(): Builder;
}
