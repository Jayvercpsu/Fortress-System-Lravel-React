<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Project extends Model
{
    use SoftDeletes;

    public const PHASE_DESIGN = 'Design';
    public const PHASE_CONSTRUCTION = 'Construction';
    public const PHASE_COMPLETED = 'Completed';

    public const PHASE_OPTIONS = [
        self::PHASE_DESIGN,
        self::PHASE_CONSTRUCTION,
        self::PHASE_COMPLETED,
    ];

    public const ASSIGNED_ROLE_ARCHITECT = 'Architect';
    public const ASSIGNED_ROLE_ENGINEER = 'Engineer';
    public const ASSIGNED_ROLE_PM = 'PM';
    public const ASSIGNED_ROLE_DESIGNER = 'Designer';

    public const ASSIGNED_ROLE_OPTIONS = [
        self::ASSIGNED_ROLE_ARCHITECT,
        self::ASSIGNED_ROLE_ENGINEER,
        self::ASSIGNED_ROLE_PM,
        self::ASSIGNED_ROLE_DESIGNER,
    ];

    protected $fillable = [
        'source_project_id',
        'user_id',
        'name',
        'client',
        'type',
        'location',
        'assigned_role',
        'assigned',
        'target',
        'status',
        'phase',
        'overall_progress',
        'contract_amount',
        'design_fee',
        'construction_cost',
        'total_client_payment',
        'remaining_balance',
        'last_paid_date',
    ];

    protected $casts = [
        'source_project_id' => 'integer',
        'user_id' => 'integer',
        'target' => 'date',
        'overall_progress' => 'integer',
        'contract_amount' => 'decimal:2',
        'design_fee' => 'decimal:2',
        'construction_cost' => 'decimal:2',
        'total_client_payment' => 'decimal:2',
        'remaining_balance' => 'decimal:2',
        'last_paid_date' => 'date',
    ];

    public function files()
    {
        return $this->hasMany(ProjectFile::class);
    }

    public function updates()
    {
        return $this->hasMany(ProjectUpdate::class);
    }

    public function scopes()
    {
        return $this->hasMany(ProjectScope::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function assignments()
    {
        return $this->hasMany(ProjectAssignment::class);
    }

    public function teamMembers()
    {
        return $this->hasMany(ProjectWorker::class);
    }

    public function designTracker()
    {
        return $this->hasOne(DesignProject::class);
    }

    public function sourceProject()
    {
        return $this->belongsTo(Project::class, 'source_project_id');
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function transferredProjects()
    {
        return $this->hasMany(Project::class, 'source_project_id')->withTrashed();
    }

    public static function phaseOptions(): array
    {
        return self::PHASE_OPTIONS;
    }

    public static function assignedRoleOptions(): array
    {
        return self::ASSIGNED_ROLE_OPTIONS;
    }

    public function scopeVisibleTo(Builder $query, ?User $user): Builder
    {
        if (!$user) {
            return $query;
        }

        if ($user->role === User::ROLE_MASTER_ADMIN) {
            return $query;
        }

        if ($user->role !== User::ROLE_HEAD_ADMIN) {
            return $query;
        }

        if ($user->email === User::LEGACY_PROJECT_ACCESS_EMAIL) {
            return $query->where(function (Builder $builder) use ($user) {
                $builder
                    ->where('user_id', $user->id)
                    ->orWhereNull('user_id')
                    ->orWhereIn('user_id', User::query()->where('role', User::ROLE_MASTER_ADMIN)->select('id'));
            });
        }

        return $query->where('user_id', $user->id);
    }

    public function isVisibleTo(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        return $this->newQuery()
            ->visibleTo($user)
            ->whereKey($this->getKey())
            ->exists();
    }

    public function resolveRouteBinding($value, $field = null)
    {
        $column = $field ?? $this->getRouteKeyName();
        $query = $this->resolveRouteBindingQuery($this->newQuery(), $value, $column);

        $user = auth()->user();
        if ($user instanceof User) {
            $query->visibleTo($user);
        }

        return $query->first();
    }
}
