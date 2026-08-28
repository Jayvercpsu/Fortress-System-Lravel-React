<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcessedRecord extends Model
{
    protected $fillable = [
        'project_id',
        'user_id',
        'record_type',
        'image_index',
        'image_path',
        'ocr_raw_text',
        'ai_parsed_data',
        'ai_summary',
        'ai_model',
        'status',
        'notes',
    ];

    protected $casts = [
        'ai_parsed_data' => 'array',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope: pending records (awaiting confirmation)
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope: records needing project assignment
     */
    public function scopePendingProject($query)
    {
        return $query->where('status', 'pending_project');
    }

    /**
     * Scope: confirmed records
     */
    public function scopeConfirmed($query)
    {
        return $query->where('status', 'confirmed');
    }

    /**
     * Scope: rejected records
     */
    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    /**
     * Check if record needs project assignment
     */
    public function needsProject(): bool
    {
        return $this->status === 'pending_project' && !$this->project_id;
    }

    /**
     * Check if record can be confirmed
     */
    public function canConfirm(): bool
    {
        return in_array($this->status, ['pending', 'pending_project']) && $this->project_id;
    }
}
