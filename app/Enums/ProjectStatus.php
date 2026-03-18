<?php

namespace App\Enums;

enum ProjectStatus: string
{
    case PLANNING = 'PLANNING';
    case ACTIVE = 'ACTIVE';
    case ONGOING = 'ONGOING';
    case ON_HOLD = 'ON_HOLD';
    case DELAYED = 'DELAYED';
    case COMPLETED = 'COMPLETED';
    case CANCELLED = 'CANCELLED';

    public static function fromMixed(?string $status): self
    {
        $key = strtoupper((string) preg_replace('/[^a-z0-9]+/i', '_', trim((string) $status)));
        $key = preg_replace('/_+/', '_', $key ?? '');
        $key = trim((string) $key, '_');

        return match ($key) {
            'PLANNING' => self::PLANNING,
            'ACTIVE' => self::ACTIVE,
            'ONGOING', 'IN_PROGRESS', 'INPROGRESS' => self::ONGOING,
            'ON_HOLD', 'ONHOLD', 'HOLD' => self::ON_HOLD,
            'DELAYED' => self::DELAYED,
            'COMPLETED' => self::COMPLETED,
            'CANCELLED', 'CANCELED' => self::CANCELLED,
            default => self::PLANNING,
        };
    }
}
