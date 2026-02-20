<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class IssueReport extends Model {
    protected $fillable = ['foreman_id','issue_title','description','severity','status'];
    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
}