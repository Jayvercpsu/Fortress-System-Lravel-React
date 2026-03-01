<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectScope extends Model
{
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
}
