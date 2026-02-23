<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class ProgressPhoto extends Model {
    protected $fillable = ['foreman_id', 'project_id', 'photo_path', 'caption'];
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
    public function project() { return $this->belongsTo(Project::class); }
}
