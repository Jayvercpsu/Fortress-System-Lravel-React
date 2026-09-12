<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

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

    /**
     * Record one worker-day, merging by worker identity (name + date) instead
     * of (name + role + date).
     *
     * The grids display roles normalized to the registered worker's job
     * type, but history rows may carry AI position variants ("Legal") or
     * twins from repeated AI confirms. Matching by name + date (and
     * canonicalizing the role) guarantees an edit always lands on the row
     * the grid shows, leftover twins are merged away, and clearing a cell
     * removes every twin so stale codes can't resurface on refresh.
     */
    public static function recordDay(
        int $foremanId,
        int $projectId,
        string $workerName,
        string $workerRole,
        string $date,
        string $status = '',
        ?float $hours = null
    ): void {
        $workerName = trim($workerName);
        $date = trim($date);
        if ($workerName === '' || $date === '') {
            return;
        }

        // Canonical role: the registered worker's job type when known, so
        // AI variants and display normalization resolve to one row.
        $registeredRole = trim((string) (Worker::query()
            ->where('foreman_id', $foremanId)
            ->whereRaw('LOWER(name) = ?', [Str::lower($workerName)])
            ->value('job_type') ?? ''));
        $role = $registeredRole !== '' ? $registeredRole : trim($workerRole);
        $role = $role !== '' ? $role : Worker::JOB_TYPE_WORKER;

        $twins = static::query()
            ->where('foreman_id', $foremanId)
            ->where('project_id', $projectId)
            ->whereRaw('LOWER(worker_name) = ?', [Str::lower($workerName)])
            ->whereDate('date', $date)
            ->orderBy('id')
            ->get();

        if ($status === '' && $hours === null) {
            foreach ($twins as $twin) {
                $twin->delete();
            }

            return;
        }

        $attributes = [
            'worker_role' => $role,
            'hours' => $hours ?? (float) (self::STATUS_HOURS[$status] ?? 0),
        ];
        if ($status !== '') {
            $attributes['attendance_code'] = $status;
            $attributes['time_in'] = null;
            $attributes['time_out'] = null;
            $attributes['selfie_path'] = null;
        }

        $existing = $twins->first(fn ($row) => trim((string) $row->worker_role) === $role)
            ?? $twins->first();

        if ($existing) {
            $existing->update($attributes);
            $keepId = $existing->id;
        } else {
            $created = static::query()->create([
                'foreman_id' => $foremanId,
                'project_id' => $projectId,
                'worker_name' => $workerName,
                'worker_role' => $role,
                'date' => $date,
                'attendance_code' => $status !== '' ? $status : null,
                'hours' => $attributes['hours'],
            ]);
            $keepId = $created->id;
        }

        static::query()
            ->where('foreman_id', $foremanId)
            ->where('project_id', $projectId)
            ->whereRaw('LOWER(worker_name) = ?', [Str::lower($workerName)])
            ->whereDate('date', $date)
            ->where('id', '!=', $keepId)
            ->delete();
    }
}
