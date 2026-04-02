<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monitoring_board_items', function (Blueprint $table) {
            $table->json('design_computation_basis')->nullable()->after('client_approval_status');
        });
    }

    public function down(): void
    {
        Schema::table('monitoring_board_items', function (Blueprint $table) {
            $table->dropColumn('design_computation_basis');
        });
    }
};
