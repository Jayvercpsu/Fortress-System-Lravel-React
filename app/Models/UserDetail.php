<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserDetail extends Model
{
    use HasFactory;

    public const SEX_MALE = 'male';
    public const SEX_FEMALE = 'female';
    public const SEX_OTHER = 'other';

    public const SEX_OPTIONS = [
        self::SEX_MALE,
        self::SEX_FEMALE,
        self::SEX_OTHER,
    ];

    protected $fillable = [
        'user_id',
        'age',
        'birth_date',
        'place_of_birth',
        'sex',
        'civil_status',
        'phone',
        'address',
        'profile_photo_path',
    ];

    protected $casts = [
        'birth_date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public static function sexOptions(): array
    {
        return self::SEX_OPTIONS;
    }
}
