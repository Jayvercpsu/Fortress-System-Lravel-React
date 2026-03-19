<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProgressPhoto extends Model {
    use SoftDeletes;

    public const CATEGORIES = [
        'Slab Work',
        'Plumbing Rough-in',
        'Electrical',
        'Masonry',
        'Finishing',
        'Safety',
        'General Progress',
    ];

    protected $fillable = ['foreman_id', 'project_id', 'photo_path', 'caption'];

    public static function categories(): array
    {
        return self::CATEGORIES;
    }

    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
    public function project() { return $this->belongsTo(Project::class); }
}
