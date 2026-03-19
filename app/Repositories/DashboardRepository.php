<?php

namespace App\Repositories;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\Expense;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\Payroll;
use App\Models\ProgressPhoto;
use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectScope;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Repositories\Contracts\DashboardRepositoryInterface;
use Illuminate\Database\Eloquent\Builder;

class DashboardRepository implements DashboardRepositoryInterface
{
    public function users(): Builder
    {
        return User::query();
    }

    public function materialRequests(): Builder
    {
        return MaterialRequest::query();
    }

    public function issueReports(): Builder
    {
        return IssueReport::query();
    }

    public function payrolls(): Builder
    {
        return Payroll::query();
    }

    public function projects(): Builder
    {
        return Project::query();
    }

    public function attendances(): Builder
    {
        return Attendance::query();
    }

    public function weeklyAccomplishments(): Builder
    {
        return WeeklyAccomplishment::query();
    }

    public function deliveries(): Builder
    {
        return DeliveryConfirmation::query();
    }

    public function progressPhotos(): Builder
    {
        return ProgressPhoto::query();
    }

    public function projectScopes(): Builder
    {
        return ProjectScope::query();
    }

    public function scopePhotos(): Builder
    {
        return ScopePhoto::query();
    }

    public function projectAssignments(): Builder
    {
        return ProjectAssignment::query();
    }

    public function progressSubmitTokens(): Builder
    {
        return ProgressSubmitToken::query();
    }

    public function expenses(): Builder
    {
        return Expense::query();
    }

    public function createProgressSubmitToken(array $attributes): ProgressSubmitToken
    {
        return ProgressSubmitToken::query()->create($attributes);
    }
}
