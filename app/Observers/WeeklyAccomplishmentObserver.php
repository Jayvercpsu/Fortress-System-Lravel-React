<?php

namespace App\Observers;

use App\Models\Project;
use App\Models\WeeklyAccomplishment;

class WeeklyAccomplishmentObserver
{
    public function created(WeeklyAccomplishment $weeklyAccomplishment): void
    {
        $this->syncProjectOverallProgressFromWeekly((int) $weeklyAccomplishment->project_id);
    }

    public function updated(WeeklyAccomplishment $weeklyAccomplishment): void
    {
        $this->syncProjectOverallProgressFromWeekly((int) $weeklyAccomplishment->project_id);

        if ($weeklyAccomplishment->wasChanged('project_id')) {
            $this->syncProjectOverallProgressFromWeekly((int) $weeklyAccomplishment->getOriginal('project_id'));
        }
    }

    public function deleted(WeeklyAccomplishment $weeklyAccomplishment): void
    {
        $this->syncProjectOverallProgressFromWeekly((int) $weeklyAccomplishment->project_id);
    }

    public function restored(WeeklyAccomplishment $weeklyAccomplishment): void
    {
        $this->syncProjectOverallProgressFromWeekly((int) $weeklyAccomplishment->project_id);
    }

    private function syncProjectOverallProgressFromWeekly(int $projectId): void
    {
        if ($projectId <= 0) {
            return;
        }

        $project = Project::query()->find($projectId);
        if (!$project) {
            return;
        }

        $progressPercent = WeeklyAccomplishment::query()
            ->where('project_id', $projectId)
            ->avg('percent_completed');

        if ($progressPercent === null) {
            $progressPercent = (float) ($project->scopes()->avg('progress_percent') ?? 0);
        }

        $overallProgress = (int) round(max(0, min(100, (float) $progressPercent)));

        if ((int) ($project->overall_progress ?? 0) !== $overallProgress) {
            $project->update([
                'overall_progress' => $overallProgress,
            ]);
        }
    }
}
