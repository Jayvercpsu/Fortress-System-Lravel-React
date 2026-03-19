<?php

namespace App\Support\Projects;

use App\Enums\ProjectStatus;
use App\Models\DesignProject;
use App\Models\Project;

class ProjectFlow
{
    public static function statuses(): array
    {
        return array_map(
            fn (ProjectStatus $status) => $status->value,
            ProjectStatus::cases()
        );
    }

    public static function phases(): array
    {
        return Project::phaseOptions();
    }

    public static function assignedRoles(): array
    {
        return Project::assignedRoleOptions();
    }

    public static function phaseValidationValues(): array
    {
        return collect(Project::phaseOptions())
            ->flatMap(fn (string $phase) => [
                $phase,
                strtoupper($phase),
                strtoupper((string) preg_replace('/[^a-z0-9]+/i', '', $phase)),
            ])
            ->unique()
            ->values()
            ->all();
    }

    public static function phaseMatchKey(string $phase): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/i', '', self::normalizePhase($phase)));
    }

    public static function phaseMatchKeys(string $phase): array
    {
        $key = self::phaseMatchKey($phase);

        return match ($key) {
            'construction' => ['construction', 'forbuild'],
            'completed' => ['completed', 'turnover'],
            default => [$key],
        };
    }

    public static function normalizePhase(?string $phase): string
    {
        $key = strtolower((string) preg_replace('/[^a-z0-9]+/i', '', trim((string) $phase)));

        return match ($key) {
            'design' => Project::PHASE_DESIGN,
            'forbuild', 'construction' => Project::PHASE_CONSTRUCTION,
            'turnover', 'completed' => Project::PHASE_COMPLETED,
            default => Project::PHASE_DESIGN,
        };
    }

    public static function normalizeStatus(?string $status): string
    {
        return ProjectStatus::fromMixed($status)->value;
    }

    public static function invalidAssignedRoles(mixed $roles): array
    {
        return collect(self::splitAssignedRoleEntries($roles))
            ->filter()
            ->reject(fn ($entry) => self::parseAssignedRoleEntry($entry) !== null)
            ->values()
            ->all();
    }

    public static function normalizeAssignedRoleList(mixed $roles): ?string
    {
        $normalized = collect(self::splitAssignedRoleEntries($roles))
            ->map(fn ($entry) => self::parseAssignedRoleEntry($entry))
            ->filter()
            ->map(fn (array $entry) => $entry['name'] !== null && $entry['name'] !== ''
                ? "{$entry['role']}: {$entry['name']}"
                : $entry['role'])
            ->unique(fn ($entry) => mb_strtolower((string) $entry))
            ->values();

        return $normalized->isEmpty() ? null : $normalized->implode('; ');
    }

    public static function normalizeDesignApprovalStatus(?string $status): string
    {
        $normalized = strtolower(trim((string) $status));

        return match ($normalized) {
            DesignProject::CLIENT_APPROVAL_APPROVED => ucfirst(DesignProject::CLIENT_APPROVAL_APPROVED),
            DesignProject::CLIENT_APPROVAL_REJECTED => ucfirst(DesignProject::CLIENT_APPROVAL_REJECTED),
            default => ucfirst(DesignProject::CLIENT_APPROVAL_PENDING),
        };
    }

    private static function splitAssignedRoleEntries(mixed $roles): array
    {
        $raw = trim((string) ($roles ?? ''));
        if ($raw === '') {
            return [];
        }

        $pattern = str_contains($raw, ';') ? '/[;]+/' : '/[,]+/';

        return collect(preg_split($pattern, $raw))
            ->map(fn ($entry) => trim((string) $entry))
            ->filter()
            ->values()
            ->all();
    }

    private static function parseAssignedRoleEntry(?string $entry): ?array
    {
        $entry = trim((string) $entry);
        if ($entry === '') {
            return null;
        }

        $rolePart = $entry;
        $namePart = null;

        if (preg_match('/^(.+?)\s*(?:[:\-])\s*(.+)$/u', $entry, $matches)) {
            $rolePart = trim((string) ($matches[1] ?? ''));
            $namePart = trim((string) ($matches[2] ?? ''));
        }

        $role = self::normalizeSingleAssignedRole($rolePart);
        if ($role === null) {
            return null;
        }

        return [
            'role' => $role,
            'name' => $namePart !== null && $namePart !== '' ? $namePart : null,
        ];
    }

    private static function normalizeSingleAssignedRole(?string $role): ?string
    {
        $key = strtolower((string) preg_replace('/[^a-z0-9]+/i', '', trim((string) $role)));

        return match ($key) {
            '' => null,
            'architect' => Project::ASSIGNED_ROLE_ARCHITECT,
            'engineer' => Project::ASSIGNED_ROLE_ENGINEER,
            'pm' => Project::ASSIGNED_ROLE_PM,
            default => null,
        };
    }
}
