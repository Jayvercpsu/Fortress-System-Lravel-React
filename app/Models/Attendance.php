<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class Attendance extends Model {
    protected $fillable = [
        'foreman_id',
        'project_id',
        'worker_name',
        'worker_role',
        'date',
        'time_in',
        'time_out',
        'hours',
        'selfie_path',
    ];

    protected $casts = [
        'date' => 'date',
        'hours' => 'decimal:1',
    ];

    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
    public function project() { return $this->belongsTo(Project::class); }
}
