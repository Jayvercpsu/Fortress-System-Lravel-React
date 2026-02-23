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
    ];

    protected $casts = [
        'progress_percent' => 'integer',
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
