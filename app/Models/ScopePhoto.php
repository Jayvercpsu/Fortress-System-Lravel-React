<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ScopePhoto extends Model
{
    use SoftDeletes;

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
