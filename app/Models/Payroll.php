<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payroll extends Model
{
    protected $fillable = [
        'user_id',
        'cutoff_id',
        'worker_name',
        'role',
        'hours',
        'rate_per_hour',
        'gross',
        'deductions',
        'net',
        'status',
        'week_start',
        'released_at',
        'released_by',
        'payment_reference',
        'bank_export_ref',
    ];

    protected $casts = [
        'hours' => 'decimal:2',
        'rate_per_hour' => 'decimal:2',
        'gross' => 'decimal:2',
        'deductions' => 'decimal:2',
        'net' => 'decimal:2',
        'week_start' => 'date',
        'released_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function cutoff()
    {
        return $this->belongsTo(PayrollCutoff::class, 'cutoff_id');
    }

    public function deductionItems()
    {
        return $this->hasMany(PayrollDeduction::class)->orderByDesc('id');
    }

    public function releasedBy()
    {
        return $this->belongsTo(User::class, 'released_by');
    }
}
