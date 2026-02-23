<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class ProgressSubmitToken extends Model
{
    protected $fillable = [
        'project_id',
        'foreman_id',
        'token',
        'expires_at',
        'revoked_at',
        'last_submitted_at',
        'submission_count',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
        'last_submitted_at' => 'datetime',
        'submission_count' => 'integer',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function foreman()
    {
        return $this->belongsTo(User::class, 'foreman_id');
    }

    public function isActive(): bool
    {
        if ($this->revoked_at !== null) {
            return false;
        }

        if ($this->expires_at !== null && $this->expires_at->isPast()) {
            return false;
        }

        return true;
    }

    public function markSubmitted(?Carbon $when = null): void
    {
        $this->last_submitted_at = $when ?? now();
        $this->submission_count = ((int) $this->submission_count) + 1;
        $this->save();
    }
}
