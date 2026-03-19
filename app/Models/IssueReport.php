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
    public const URGENCY_LOW = 'low';
    public const URGENCY_NORMAL = 'normal';
    public const URGENCY_HIGH = 'high';

    public const STATUS_OPTIONS = [
        self::STATUS_OPEN,
        self::STATUS_RESOLVED,
    ];

    public const URGENCY_OPTIONS = [
        self::URGENCY_LOW,
        self::URGENCY_NORMAL,
        self::URGENCY_HIGH,
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
        return $urgency === self::URGENCY_NORMAL
            ? self::SEVERITY_MEDIUM
            : $urgency;
    }

    public function project() { return $this->belongsTo(Project::class, 'project_id'); }
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
}
