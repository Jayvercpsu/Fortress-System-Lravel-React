<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollCutoff extends Model
{
    public const STATUS_GENERATED = 'generated';
    public const STATUS_PAID = 'paid';

    public const STATUS_OPTIONS = [
        self::STATUS_GENERATED,
        self::STATUS_PAID,
    ];

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

    public static function statusOptions(): array
    {
        return self::STATUS_OPTIONS;
    }
}
