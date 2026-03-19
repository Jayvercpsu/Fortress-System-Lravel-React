<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollDeduction extends Model
{
    public const TYPE_CASH_ADVANCE = 'cash_advance';
    public const TYPE_LOAN = 'loan';
    public const TYPE_OTHER = 'other';

    public const TYPE_OPTIONS = [
        self::TYPE_CASH_ADVANCE,
        self::TYPE_LOAN,
        self::TYPE_OTHER,
    ];

    protected $fillable = [
        'payroll_id',
        'type',
        'amount',
        'note',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function payroll()
    {
        return $this->belongsTo(Payroll::class);
    }

    public static function typeOptions(): array
    {
        return self::TYPE_OPTIONS;
    }
}
