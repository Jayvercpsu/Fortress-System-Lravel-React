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
        'Wall Footing',
        'Second-Floor Beam, Slab and Stairs',
        'Slab on Fill',
        'CHB Laying with Plastering',
        'Garage Flooring',
        'Roof Facade and Garage Partition',
        'Roofing and Tinsmithry (garage included)',
        'Roof Beam',
        'Ceiling Works',
        'Doors and Jambs',
        'Aluminum Doors and Windows',
        'Second-Floor Level Floor Tile',
        'Lower Level Floor Tile',
        'Kitchen Counter Cabinet',
        'Canopy',
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
