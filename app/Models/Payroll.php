<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payroll extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_READY = 'ready';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PAID = 'paid';

    public const PAYABLE_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_READY,
        self::STATUS_APPROVED,
    ];

    public const STATUS_OPTIONS = [
        self::STATUS_PENDING,
        self::STATUS_READY,
        self::STATUS_APPROVED,
        self::STATUS_PAID,
    ];

    public const ROLE_FOREMAN = 'Foreman';
    public const ROLE_WORKER = 'Worker';

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

    public static function payableStatuses(): array
    {
        return self::PAYABLE_STATUSES;
    }

    public static function statusOptions(): array
    {
        return self::STATUS_OPTIONS;
    }
}
