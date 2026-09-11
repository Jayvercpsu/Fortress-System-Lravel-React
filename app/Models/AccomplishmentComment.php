<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccomplishmentComment extends Model {
    protected $fillable = ['weekly_accomplishment_id', 'user_id', 'body'];

    public function accomplishment() { return $this->belongsTo(WeeklyAccomplishment::class, 'weekly_accomplishment_id'); }
    public function author() { return $this->belongsTo(User::class, 'user_id'); }
}
