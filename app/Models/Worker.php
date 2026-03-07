<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Worker extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'foreman_id',
        'project_id',
        'name',
        'job_type',
        'default_rate_per_hour',
        'birth_date',
        'place_of_birth',
        'sex',
        'civil_status',
        'phone',
        'address',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'default_rate_per_hour' => 'decimal:2',
    ];

    public function foreman()
    {
        return $this->belongsTo(User::class, 'foreman_id');
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
