<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_scopes', function (Blueprint $table) {
            $table->decimal('contract_amount', 14, 2)->default(0);
            $table->decimal('weight_percent', 5, 2)->default(0);
            $table->date('start_date')->nullable();
            $table->date('target_completion')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('project_scopes', function (Blueprint $table) {
            $table->dropColumn(['contract_amount', 'weight_percent', 'start_date', 'target_completion']);
        });
    }
};
