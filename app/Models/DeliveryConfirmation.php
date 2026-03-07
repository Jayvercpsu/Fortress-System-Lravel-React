<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryConfirmation extends Model {
    use SoftDeletes;

    protected $fillable = ['project_id','foreman_id','item_delivered','quantity','delivery_date','supplier','status','photo_path'];
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
    public function project() { return $this->belongsTo(Project::class, 'project_id'); }
}
