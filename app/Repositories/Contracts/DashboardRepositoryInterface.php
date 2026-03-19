<?php

namespace App\Repositories\Contracts;

use App\Models\ProgressSubmitToken;
use Illuminate\Database\Eloquent\Builder;

interface DashboardRepositoryInterface
{
    public function users(): Builder;

    public function materialRequests(): Builder;

    public function issueReports(): Builder;

    public function payrolls(): Builder;

    public function projects(): Builder;

    public function attendances(): Builder;

    public function weeklyAccomplishments(): Builder;

    public function deliveries(): Builder;

    public function progressPhotos(): Builder;

    public function projectScopes(): Builder;

    public function scopePhotos(): Builder;

    public function projectAssignments(): Builder;

    public function progressSubmitTokens(): Builder;

    public function expenses(): Builder;

    public function createProgressSubmitToken(array $attributes): ProgressSubmitToken;
}
