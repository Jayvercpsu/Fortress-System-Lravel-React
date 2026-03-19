<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProjectAssignment extends Model
{
    use SoftDeletes;

    public const ROLE_FOREMAN = 'foreman';
    public const ROLE_CLIENT = 'client';

    public const ROLE_OPTIONS = [
        self::ROLE_FOREMAN,
        self::ROLE_CLIENT,
    ];

    protected $fillable = [
        'project_id',
        'user_id',
        'role_in_project',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public static function roleOptions(): array
    {
        return self::ROLE_OPTIONS;
    }
}
