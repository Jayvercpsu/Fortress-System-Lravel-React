<?php

namespace App\Repositories;

use App\Models\Attendance;
use App\Models\DeliveryConfirmation;
use App\Models\IssueReport;
use App\Models\MaterialRequest;
use App\Models\ProgressPhoto;
use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\ProjectAssignment;
use App\Models\ProjectFile;
use App\Models\ProjectScope;
use App\Models\ProjectUpdate;
use App\Models\ScopePhoto;
use App\Models\User;
use App\Models\WeeklyAccomplishment;
use App\Models\Worker;
use App\Repositories\Contracts\ForemanProgressRepositoryInterface;
use Illuminate\Database\Eloquent\Builder;

class ForemanProgressRepository implements ForemanProgressRepositoryInterface
{
    public function attendances(): Builder
    {
        return Attendance::query();
    }

    public function deliveries(): Builder
    {
        return DeliveryConfirmation::query();
    }

    public function issueReports(): Builder
    {
        return IssueReport::query();
    }

    public function materialRequests(): Builder
    {
        return MaterialRequest::query();
    }

    public function progressPhotos(): Builder
    {
        return ProgressPhoto::query();
    }

    public function progressSubmitTokens(): Builder
    {
        return ProgressSubmitToken::query();
    }

    public function projects(): Builder
    {
        return Project::query();
    }

    public function projectAssignments(): Builder
    {
        return ProjectAssignment::query();
    }

    public function projectFiles(): Builder
    {
        return ProjectFile::query();
    }

    public function projectScopes(): Builder
    {
        return ProjectScope::query();
    }

    public function projectUpdates(): Builder
    {
        return ProjectUpdate::query();
    }

    public function scopePhotos(): Builder
    {
        return ScopePhoto::query();
    }

    public function users(): Builder
    {
        return User::query();
    }

    public function weeklyAccomplishments(): Builder
    {
        return WeeklyAccomplishment::query();
    }

    public function workers(): Builder
    {
        return Worker::query();
    }
}
