<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryConfirmation extends Model {
    use SoftDeletes;

    public const STATUS_RECEIVED = 'received';
    public const STATUS_INCOMPLETE = 'incomplete';
    public const STATUS_REJECTED = 'rejected';
    public const PUBLIC_STATUS_COMPLETE = 'complete';
    public const PUBLIC_STATUS_INCOMPLETE = 'incomplete';

    public const STATUS_OPTIONS = [
        self::STATUS_RECEIVED,
        self::STATUS_INCOMPLETE,
        self::STATUS_REJECTED,
    ];

    public const PUBLIC_STATUS_OPTIONS = [
        self::PUBLIC_STATUS_COMPLETE,
        self::PUBLIC_STATUS_INCOMPLETE,
    ];

    protected $fillable = ['project_id','foreman_id','item_delivered','quantity','delivery_date','supplier','status','photo_path'];

    public static function statusOptions(): array
    {
        return self::STATUS_OPTIONS;
    }

    public static function publicStatusOptions(): array
    {
        return self::PUBLIC_STATUS_OPTIONS;
    }

    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
    public function project() { return $this->belongsTo(Project::class, 'project_id'); }
}
