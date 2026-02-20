<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class MaterialRequest extends Model {
    protected $fillable = ['foreman_id','material_name','quantity','unit','remarks','status'];
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
}