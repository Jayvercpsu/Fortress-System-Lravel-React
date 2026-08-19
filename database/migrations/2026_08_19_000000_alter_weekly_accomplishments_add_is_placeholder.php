<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('weekly_accomplishments', function (Blueprint $table) {
            if (!Schema::hasColumn('weekly_accomplishments', 'is_placeholder')) {
                $table->boolean('is_placeholder')->default(false)->after('week_start');
            }
        });
    }

    public function down(): void
    {
        Schema::table('weekly_accomplishments', function (Blueprint $table) {
            if (Schema::hasColumn('weekly_accomplishments', 'is_placeholder')) {
                $table->dropColumn('is_placeholder');
            }
        });
    }
};