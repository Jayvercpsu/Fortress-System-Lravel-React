<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BuildProject extends Model
{
    protected $fillable = [
        'project_id',
        'construction_contract',
        'total_client_payment',
        'materials_cost',
        'labor_cost',
        'equipment_cost',
    ];

    protected $casts = [
        'construction_contract' => 'decimal:2',
        'total_client_payment' => 'decimal:2',
        'materials_cost' => 'decimal:2',
        'labor_cost' => 'decimal:2',
        'equipment_cost' => 'decimal:2',
    ];
}
