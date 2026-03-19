<?php

namespace App\Repositories;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\KpiRepositoryInterface;
use Illuminate\Database\Eloquent\Builder;

class KpiRepository implements KpiRepositoryInterface
{
    public function attendances(): Builder
    {
        return Attendance::query();
    }

    public function weeklyAccomplishments(): Builder
    {
        return WeeklyAccomplishment::query();
    }

    public function issueReports(): Builder
    {
        return IssueReport::query();
    }

    public function materialRequests(): Builder
    {
        return MaterialRequest::query();
    }

    public function deliveries(): Builder
    {
        return DeliveryConfirmation::query();
    }

    public function progressPhotos(): Builder
    {
        return ProgressPhoto::query();
    }

    public function users(): Builder
    {
        return User::query();
    }
}
