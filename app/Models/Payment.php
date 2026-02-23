<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'project_id',
        'amount',
        'date_paid',
        'reference',
        'note',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'date_paid' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
