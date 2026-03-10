<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monitoring_board_items', function (Blueprint $table) {
            $table->date('start_date')->nullable()->after('status');
            $table->string('timeline')->nullable()->after('start_date');
            $table->date('due_date')->nullable()->after('timeline');
            $table->date('date_paid')->nullable()->after('due_date');
        });
    }

    public function down(): void
    {
        Schema::table('monitoring_board_items', function (Blueprint $table) {
            $table->dropColumn(['start_date', 'timeline', 'due_date', 'date_paid']);
        });
    }
};
