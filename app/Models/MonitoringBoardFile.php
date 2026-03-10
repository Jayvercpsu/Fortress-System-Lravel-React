<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MonitoringBoardFile extends Model
{
    protected $fillable = [
        'monitoring_board_item_id',
        'file_path',
        'original_name',
        'mime_type',
        'uploaded_by',
    ];

    public function item()
    {
        return $this->belongsTo(MonitoringBoardItem::class, 'monitoring_board_item_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
