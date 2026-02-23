<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScopePhoto extends Model
{
    protected $fillable = [
        'project_scope_id',
        'photo_path',
        'caption',
    ];

    public function scope()
    {
        return $this->belongsTo(ProjectScope::class, 'project_scope_id');
    }
}
