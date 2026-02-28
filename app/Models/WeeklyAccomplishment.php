<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class WeeklyAccomplishment extends Model {
    protected $fillable = ['foreman_id','project_id','scope_of_work','percent_completed','week_start'];

    protected $casts = [
        'week_start' => 'date',
        'percent_completed' => 'decimal:2',
    ];

    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
    public function project() { return $this->belongsTo(Project::class); }
}
