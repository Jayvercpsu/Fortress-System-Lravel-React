<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Worker extends Model
{
    protected $fillable = [
        'foreman_id',
        'name',
        'birth_date',
        'place_of_birth',
        'sex',
        'civil_status',
        'phone',
        'address',
    ];

    protected $casts = [
        'birth_date' => 'date',
    ];

    public function foreman()
    {
        return $this->belongsTo(User::class, 'foreman_id');
    }
}
