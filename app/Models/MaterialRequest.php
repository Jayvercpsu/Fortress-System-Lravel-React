<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaterialRequest extends Model {
    use SoftDeletes;

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const STATUS_OPTIONS = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_REJECTED,
    ];

    protected $fillable = ['project_id','foreman_id','material_name','quantity','unit','remarks','status','photo_path'];

    public static function statusOptions(): array
    {
        return self::STATUS_OPTIONS;
    }

    public function project() { return $this->belongsTo(Project::class, 'project_id'); }
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
}
