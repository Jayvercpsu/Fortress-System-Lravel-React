<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model {
    protected $fillable = ['foreman_id','worker_name','worker_role','date','hours'];
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
}