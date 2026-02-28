<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class MaterialRequest extends Model {
    protected $fillable = ['project_id','foreman_id','material_name','quantity','unit','remarks','status','photo_path'];
    public function project() { return $this->belongsTo(Project::class, 'project_id'); }
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
}
