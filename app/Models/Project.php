<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'source_project_id',
        'name',
        'client',
        'type',
        'location',
        'assigned_role',
        'assigned',
        'target',
        'status',
        'phase',
        'overall_progress',
        'contract_amount',
        'design_fee',
        'construction_cost',
        'total_client_payment',
        'remaining_balance',
        'last_paid_date',
    ];

    protected $casts = [
        'source_project_id' => 'integer',
        'target' => 'date',
        'overall_progress' => 'integer',
        'contract_amount' => 'decimal:2',
        'design_fee' => 'decimal:2',
        'construction_cost' => 'decimal:2',
        'total_client_payment' => 'decimal:2',
        'remaining_balance' => 'decimal:2',
        'last_paid_date' => 'date',
    ];

    public function files()
    {
        return $this->hasMany(ProjectFile::class);
    }

    public function updates()
    {
        return $this->hasMany(ProjectUpdate::class);
    }

    public function scopes()
    {
        return $this->hasMany(ProjectScope::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function assignments()
    {
        return $this->hasMany(ProjectAssignment::class);
    }

    public function teamMembers()
    {
        return $this->hasMany(ProjectWorker::class);
    }

    public function designTracker()
    {
        return $this->hasOne(DesignProject::class);
    }

    public function sourceProject()
    {
        return $this->belongsTo(Project::class, 'source_project_id');
    }

    public function transferredProjects()
    {
        return $this->hasMany(Project::class, 'source_project_id')->withTrashed();
    }
}
