<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use SoftDeletes;

    public const CATEGORY_UNCATEGORIZED = 'Uncategorized';
    public const CATEGORY_UNCATEGORIZED_KEY = 'uncategorized';

    public const DEFAULT_CATEGORIES = [
        'Materials',
        'Labor',
        'Equipment',
        'Miscellaneous',
        'Others',
    ];

    protected $fillable = [
        'project_id',
        'category',
        'amount',
        'note',
        'date',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'date' => 'date',
    ];

    public static function defaultCategories(): array
    {
        return self::DEFAULT_CATEGORIES;
    }
}
