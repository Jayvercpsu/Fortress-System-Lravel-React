<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class IssueReport extends Model {
    use SoftDeletes;

    public const STATUS_OPEN = 'open';
    public const STATUS_RESOLVED = 'resolved';
    public const SEVERITY_LOW = 'low';
    public const SEVERITY_MEDIUM = 'medium';
    public const SEVERITY_HIGH = 'high';
    public const SEVERITY_CRITICAL = 'critical';
    public const URGENCY_LOW = 'low';
    public const URGENCY_MEDIUM = 'medium';
    public const URGENCY_HIGH = 'high';
    public const URGENCY_CRITICAL = 'critical';

    public const STATUS_OPTIONS = [
        self::STATUS_OPEN,
        self::STATUS_RESOLVED,
    ];

    public const URGENCY_OPTIONS = [
        self::URGENCY_LOW,
        self::URGENCY_MEDIUM,
        self::URGENCY_HIGH,
        self::URGENCY_CRITICAL,
    ];

    protected $fillable = ['project_id','foreman_id','issue_title','description','severity','status','photo_path'];

    public static function statusOptions(): array
    {
        return self::STATUS_OPTIONS;
    }

    public static function urgencyOptions(): array
    {
        return self::URGENCY_OPTIONS;
    }

    public static function urgencyToSeverity(string $urgency): string
    {
        // Legacy 'normal' input (renamed to 'medium') keeps mapping to medium.
        if ($urgency === 'normal' || $urgency === self::URGENCY_MEDIUM) {
            return self::SEVERITY_MEDIUM;
        }

        return $urgency;
    }

    public function project() { return $this->belongsTo(Project::class, 'project_id'); }
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
}
