<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class DeliveryConfirmation extends Model {
    protected $fillable = ['foreman_id','item_delivered','quantity','delivery_date','supplier','status'];
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
}