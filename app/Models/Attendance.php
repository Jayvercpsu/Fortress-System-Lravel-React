<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Attendance extends Model {
    use SoftDeletes;

    public const PH_TIMEZONE = 'Asia/Manila';
    public const ENTRY_MODE_TIME_LOG = 'time_log';
    public const ENTRY_MODE_STATUS_BASED = 'status_based';
    public const CODE_PRESENT = 'P';
    public const CODE_ABSENT = 'A';
    public const CODE_HALF_DAY = 'H';
    public const CODE_REST_DAY = 'R';
    public const CODE_FIELD_WORK = 'F';
    public const ROLE_FOREMAN = 'Foreman';
    public const ROLE_WORKER = 'Worker';
    public const DERIVED_ZERO_HOURS_LABEL = 'A/R/F';

    public const CODES = [
        self::CODE_PRESENT,
        self::CODE_ABSENT,
        self::CODE_HALF_DAY,
        self::CODE_REST_DAY,
        self::CODE_FIELD_WORK,
    ];

    public const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    public const DAY_OFFSETS = [
        'mon' => 0,
        'tue' => 1,
        'wed' => 2,
        'thu' => 3,
        'fri' => 4,
        'sat' => 5,
        'sun' => 6,
    ];

    public const WEEKDAY_SHORT_TO_KEY = [
        'Mon' => 'mon',
        'Tue' => 'tue',
        'Wed' => 'wed',
        'Thu' => 'thu',
        'Fri' => 'fri',
        'Sat' => 'sat',
        'Sun' => 'sun',
    ];

    public const STATUS_HOURS = [
        self::CODE_PRESENT => 8.0,
        self::CODE_ABSENT => 0.0,
        self::CODE_HALF_DAY => 4.0,
        self::CODE_REST_DAY => 0.0,
        self::CODE_FIELD_WORK => 0.0,
    ];

    protected $fillable = [
        'foreman_id',
        'project_id',
        'worker_name',
        'worker_role',
        'date',
        'time_in',
        'time_out',
        'hours',
        'attendance_code',
        'selfie_path',
    ];

    protected $casts = [
        'date' => 'date',
        'hours' => 'decimal:1',
    ];

    public static function codes(): array
    {
        return self::CODES;
    }

    public static function entryModes(): array
    {
        return [
            self::ENTRY_MODE_TIME_LOG,
            self::ENTRY_MODE_STATUS_BASED,
        ];
    }

    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
    public function project() { return $this->belongsTo(Project::class); }
}
