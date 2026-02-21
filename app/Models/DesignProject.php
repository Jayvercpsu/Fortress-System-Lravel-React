<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DesignProject extends Model
{
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
}
