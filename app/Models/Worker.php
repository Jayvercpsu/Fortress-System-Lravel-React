<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Worker extends Model
{
    protected $fillable = [
        'foreman_id',
        'name',
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
}
