<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monitoring_board_items', function (Blueprint $table) {
            if (!Schema::hasColumn('monitoring_board_items', 'origin_department')) {
                $table->string('origin_department')->nullable()->after('department');
            }
        });
    }

    public function down(): void
    {
        Schema::table('monitoring_board_items', function (Blueprint $table) {
            if (Schema::hasColumn('monitoring_board_items', 'origin_department')) {
                $table->dropColumn('origin_department');
            }
        });
    }
};
