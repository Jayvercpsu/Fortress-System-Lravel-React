<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class MonitoringBoardItem extends Model
{
    public const STATUS_PROPOSAL = 'PROPOSAL';
    public const STATUS_IN_REVIEW = 'IN_REVIEW';
    public const STATUS_APPROVED = 'APPROVED';
    public const STATUS_DONE = 'DONE';

    public const STATUS_OPTIONS = [
        self::STATUS_PROPOSAL,
        self::STATUS_IN_REVIEW,
        self::STATUS_APPROVED,
        self::STATUS_DONE,
    ];

    protected $fillable = [
        'department',
        'origin_department',
        'client_name',
        'project_name',
        'project_type',
        'location',
        'assigned_to',
        'status',
        'start_date',
        'timeline',
        'due_date',
        'date_paid',
        'progress_percent',
        'remarks',
        'design_contract_amount',
        'downpayment',
        'total_received',
        'office_payroll_deduction',
        'client_approval_status',
        'design_computation_basis',
        'project_id',
        'converted_at',
        'completed_at',
        'created_by',
    ];

    protected $casts = [
        'progress_percent' => 'integer',
        'design_contract_amount' => 'decimal:2',
        'downpayment' => 'decimal:2',
        'total_received' => 'decimal:2',
        'office_payroll_deduction' => 'decimal:2',
        'design_computation_basis' => 'array',
        'converted_at' => 'datetime',
        'completed_at' => 'datetime',
        'start_date' => 'date',
        'due_date' => 'date',
        'date_paid' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function files()
    {
        return $this->hasMany(MonitoringBoardFile::class, 'monitoring_board_item_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function statusOptions(): array
    {
        return self::STATUS_OPTIONS;
    }

    /**
     * Scope items to those a user is allowed to see on the design board.
     *
     * - The master admin sees every design.
     * - The legacy buildbooks account sees designs it created as well as
     *   designs created by a master admin (it must not see designs created by
     *   other head admins).
     * - All other roles - head_admin, admin and designer - only see the
     *   designs they created.
     * Rows without a creator are visible to the master admin only.
     */
    public function scopeVisibleTo(Builder $query, ?User $user): Builder
    {
        if (!$user) {
            return $query;
        }

        if ($user->role === User::ROLE_MASTER_ADMIN) {
            return $query;
        }

        if ($user->email === User::LEGACY_PROJECT_ACCESS_EMAIL) {
            return $query->where(function (Builder $builder) use ($user) {
                $builder
                    ->where('created_by', $user->id)
                    ->orWhereIn('created_by', User::query()->where('role', User::ROLE_MASTER_ADMIN)->select('id'));
            });
        }

        return $query->where('created_by', $user->id);
    }
}
