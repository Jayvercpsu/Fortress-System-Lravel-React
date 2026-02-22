<?php
namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable {
    use HasFactory, Notifiable;

    protected $fillable = ['fullname', 'email', 'password', 'role'];
    protected $hidden   = ['password', 'remember_token'];

    protected $casts = ['password' => 'hashed'];

    public function attendances()       { return $this->hasMany(Attendance::class, 'foreman_id'); }
    public function accomplishments()   { return $this->hasMany(WeeklyAccomplishment::class, 'foreman_id'); }
    public function materialRequests()  { return $this->hasMany(MaterialRequest::class, 'foreman_id'); }
    public function issueReports()      { return $this->hasMany(IssueReport::class, 'foreman_id'); }
    public function progressPhotos()    { return $this->hasMany(ProgressPhoto::class, 'foreman_id'); }
    public function deliveries()        { return $this->hasMany(DeliveryConfirmation::class, 'foreman_id'); }
    public function detail()            { return $this->hasOne(UserDetail::class); }
}
