<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WeeklyAccomplishment extends Model {
    use SoftDeletes;

    public const DEFAULT_SCOPE_OF_WORKS = [
        'Mobilization and Hauling',
        'Foundation Preparation',
        'Column Footing',
        'Column',
        'Footing / Tie Beam',
        'Second Floor Beam, Slab, and Stairs',
        'Slab on Fill',
        'CHB Laying with Plastering',
        'Garage Flooring',
        'Roof Beam',
        'Roofing and Tinsmithry',
        'Ceiling Works',
        'Metal Works',
        'Doors and Jambs',
        'Wooden Planks (Steps)',
        'Doors and Windows',
        'Tile Works (Floor)',
        'Bathroom Wall and Floor Tiles',
        'Kitchen Counter Cabinet',
        'Electrical Works',
        'Plumbing Works',
        'Plumbing Fixtures',
        'Catch Basin (with inside plastering)',
        'Painting Works',
        'Wall (Colored)',
        'Interior Ceiling & Ceiling Eaves',
        'Doors and Stairs',
        'Outdoor Fluted Panel',
    ];

    protected $fillable = ['foreman_id','project_id','scope_of_work','percent_completed','week_start'];

    protected $casts = [
        'week_start' => 'date',
        'percent_completed' => 'decimal:2',
    ];

    public static function defaultScopeOfWorks(): array
    {
        return self::DEFAULT_SCOPE_OF_WORKS;
    }

    public function foreman() { return $this->belongsTo(User::class, 'foreman_id'); }
    public function project() { return $this->belongsTo(Project::class); }
}
