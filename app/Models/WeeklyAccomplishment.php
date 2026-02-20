<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class WeeklyAccomplishment extends Model {
    protected $fillable = ['foreman_id','scope_of_work','percent_completed','week_start'];
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
}