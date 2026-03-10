<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MonitoringBoardItem extends Model
{
    protected $fillable = [
        'department',
        'client_name',
        'project_name',
        'project_type',
        'location',
        'assigned_to',
        'status',
        'start_date',
        'timeline',
        'due_date',
        'date_paid',
        'progress_percent',
        'remarks',
        'project_id',
        'converted_at',
        'created_by',
    ];

    protected $casts = [
        'progress_percent' => 'integer',
        'converted_at' => 'datetime',
        'start_date' => 'date',
        'due_date' => 'date',
        'date_paid' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function files()
    {
        return $this->hasMany(MonitoringBoardFile::class, 'monitoring_board_item_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
