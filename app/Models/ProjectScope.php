<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProjectScope extends Model
{
    use SoftDeletes;

    public const STATUS_COMPLETED = 'COMPLETED';
    public const STATUS_NOT_STARTED = 'NOT_STARTED';
    public const STATUS_IN_PROGRESS = 'IN_PROGRESS';

    protected $fillable = [
        'project_id',
        'scope_name',
        'assigned_personnel',
        'progress_percent',
        'status',
        'remarks',
        'contract_amount',
        'weight_percent',
        'start_date',
        'target_completion',
    ];

    protected $casts = [
        'progress_percent' => 'integer',
        'contract_amount' => 'decimal:2',
        'weight_percent' => 'decimal:2',
        'start_date' => 'date',
        'target_completion' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function photos()
    {
        return $this->hasMany(ScopePhoto::class, 'project_scope_id');
    }

    public static function statusFromProgress(int $progress): string
    {
        if ($progress >= 100) {
            return self::STATUS_COMPLETED;
        }

        if ($progress <= 0) {
            return self::STATUS_NOT_STARTED;
        }

        return self::STATUS_IN_PROGRESS;
    }
}
