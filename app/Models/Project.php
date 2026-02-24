<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    protected $fillable = [
        'name',
        'client',
        'type',
        'location',
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
}
