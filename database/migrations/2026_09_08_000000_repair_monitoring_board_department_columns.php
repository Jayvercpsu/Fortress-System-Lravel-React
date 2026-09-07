<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monitoring_board_departments', function (Blueprint $table) {
            if (! Schema::hasColumn('monitoring_board_departments', 'created_by')) {
                $table->unsignedBigInteger('created_by')->nullable()->after('name');
            }
            if (! Schema::hasColumn('monitoring_board_departments', 'hidden_from_users')) {
                $table->json('hidden_from_users')->nullable()->after('created_by');
            }
        });
    }

    public function down(): void
    {
        // Intentionally left blank: do not drop these columns on rollback
        // so department visibility data is never lost.
    }
};
