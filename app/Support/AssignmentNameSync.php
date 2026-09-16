<?php

namespace App\Support;

use App\Models\Project;
use App\Models\ProjectScope;

/**
 * Keep denormalized assignment-name columns in sync when a user is renamed.
 *
 * `projects.assigned` and `project_scopes.assigned_personnel` store foreman
 * fullnames as plain text, while the weekly grids (web jotform
 * `weeklyGridPayload`, mobile `jotform` endpoint, and `saveWeeklyProgress`
 * with `$restrictToAssignedScopes`) match those columns against the user's
 * current fullname. Without a rename sync the user loses every scope that
 * still carries the old name and the grid renders "Assigned to another
 * foreman."
 */
class AssignmentNameSync
{
    public static function sync(string $oldName, string $newName): void
    {
        $oldName = trim($oldName);
        $newName = trim($newName);

        if ($oldName === '' || $newName === '' || strcasecmp($oldName, $newName) === 0) {
            return;
        }

        $like = '%' . addcslashes($oldName, '%_\\') . '%';

        Project::query()
            ->whereNotNull('assigned')
            ->where('assigned', 'like', $like)
            ->each(function (Project $project) use ($oldName, $newName) {
                $replaced = self::replaceNameSegment($project->assigned, $oldName, $newName);
                if ($replaced !== $project->assigned) {
                    $project->update(['assigned' => $replaced]);
                }
            });

        ProjectScope::query()
            ->whereNotNull('assigned_personnel')
            ->where('assigned_personnel', 'like', $like)
            ->each(function (ProjectScope $scope) use ($oldName, $newName) {
                $replaced = self::replaceNameSegment($scope->assigned_personnel, $oldName, $newName);
                if ($replaced !== $scope->assigned_personnel) {
                    $scope->update(['assigned_personnel' => $replaced]);
                }
            });
    }

    public static function replaceNameSegment(?string $value, string $oldName, string $newName): ?string
    {
        if ($value === null || trim($value) === '') {
            return $value;
        }

        $parts = preg_split('/([,;|]+)/', $value, -1, PREG_SPLIT_DELIM_CAPTURE);
        if ($parts === false) {
            return $value;
        }

        $changed = false;
        foreach ($parts as $index => $part) {
            if ($index % 2 !== 0) {
                continue;
            }
            if (strcasecmp(trim($part), $oldName) === 0) {
                $parts[$index] = str_replace(trim($part), $newName, $part);
                $changed = true;
            }
        }

        return $changed ? implode('', $parts) : $value;
    }
}
