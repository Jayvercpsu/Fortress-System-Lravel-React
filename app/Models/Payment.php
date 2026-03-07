<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use SoftDeletes;

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
