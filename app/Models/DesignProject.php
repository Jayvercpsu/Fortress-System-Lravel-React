<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DesignProject extends Model
{
    use SoftDeletes;

    public const CLIENT_APPROVAL_PENDING = 'pending';
    public const CLIENT_APPROVAL_APPROVED = 'approved';
    public const CLIENT_APPROVAL_REJECTED = 'rejected';

    public const CLIENT_APPROVAL_STATUSES = [
        self::CLIENT_APPROVAL_PENDING,
        self::CLIENT_APPROVAL_APPROVED,
        self::CLIENT_APPROVAL_REJECTED,
    ];

    protected $fillable = [
        'project_id',
        'design_contract_amount',
        'downpayment',
        'total_received',
        'office_payroll_deduction',
        'design_progress',
        'client_approval_status',
    ];

    protected $casts = [
        'design_contract_amount' => 'decimal:2',
        'downpayment' => 'decimal:2',
        'total_received' => 'decimal:2',
        'office_payroll_deduction' => 'decimal:2',
        'design_progress' => 'integer',
    ];

    public static function clientApprovalStatuses(): array
    {
        return self::CLIENT_APPROVAL_STATUSES;
    }
}
