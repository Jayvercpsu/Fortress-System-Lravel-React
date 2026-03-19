<?php

namespace App\Repositories\Contracts;

use Illuminate\Database\Eloquent\Builder;

interface ForemanProgressRepositoryInterface
{
    public function attendances(): Builder;

    public function deliveries(): Builder;

    public function issueReports(): Builder;

    public function materialRequests(): Builder;

    public function progressPhotos(): Builder;

    public function progressSubmitTokens(): Builder;

    public function projects(): Builder;

    public function projectAssignments(): Builder;

    public function projectFiles(): Builder;

    public function projectScopes(): Builder;

    public function projectUpdates(): Builder;

    public function scopePhotos(): Builder;

    public function users(): Builder;

    public function weeklyAccomplishments(): Builder;

    public function workers(): Builder;
}
