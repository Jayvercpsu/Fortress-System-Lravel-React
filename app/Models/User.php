<?php
namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable {
    use HasFactory, Notifiable;

    public const ROLE_HEAD_ADMIN = 'head_admin';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_HR = 'hr';
    public const ROLE_FOREMAN = 'foreman';
    public const ROLE_CLIENT = 'client';

    public const ROLE_OPTIONS = [
        self::ROLE_HEAD_ADMIN,
        self::ROLE_ADMIN,
        self::ROLE_HR,
        self::ROLE_FOREMAN,
        self::ROLE_CLIENT,
    ];

    public const MANAGE_ROLES = [
        self::ROLE_HEAD_ADMIN,
        self::ROLE_ADMIN,
    ];

    protected $fillable = ['fullname', 'username', 'email', 'password', 'role', 'default_rate_per_hour'];
    protected $hidden   = ['password', 'remember_token'];

    protected $casts = [
        'password' => 'hashed',
        'default_rate_per_hour' => 'decimal:2',
    ];

    public function attendances()       { return $this->hasMany(Attendance::class, 'foreman_id'); }
    public function accomplishments()   { return $this->hasMany(WeeklyAccomplishment::class, 'foreman_id'); }
    public function materialRequests()  { return $this->hasMany(MaterialRequest::class, 'foreman_id'); }
    public function issueReports()      { return $this->hasMany(IssueReport::class, 'foreman_id'); }
    public function progressPhotos()    { return $this->hasMany(ProgressPhoto::class, 'foreman_id'); }
    public function deliveries()        { return $this->hasMany(DeliveryConfirmation::class, 'foreman_id'); }
    public function workers()           { return $this->hasMany(Worker::class, 'foreman_id'); }
    public function detail()            { return $this->hasOne(UserDetail::class); }
    public function projectAssignments(){ return $this->hasMany(ProjectAssignment::class); }
    public function projectTeams()      { return $this->hasMany(ProjectWorker::class); }

    public static function roleOptions(): array
    {
        return self::ROLE_OPTIONS;
    }

    public static function manageableRoles(): array
    {
        return self::MANAGE_ROLES;
    }
}
