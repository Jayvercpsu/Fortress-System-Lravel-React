<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Payroll extends Model {
    protected $fillable = ['user_id','worker_name','role','hours','rate_per_hour','gross','deductions','net','status','week_start'];
    public function user() { return $this->belongsTo(User::class); }
}