<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectWorker extends Model
{
    protected $fillable = [
        'project_id',
        'user_id',
        'worker_name',
        'rate',
    ];

    protected $casts = [
        'rate' => 'decimal:2',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

