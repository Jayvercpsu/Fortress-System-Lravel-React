<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollCutoff extends Model
{
    protected $fillable = [
        'start_date',
        'end_date',
        'status',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function payrolls()
    {
        return $this->hasMany(Payroll::class, 'cutoff_id');
    }
}
