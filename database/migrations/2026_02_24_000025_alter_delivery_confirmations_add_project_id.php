<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('delivery_confirmations', function (Blueprint $table) {
            if (!Schema::hasColumn('delivery_confirmations', 'project_id')) {
                $table->foreignId('project_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('projects')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('delivery_confirmations', function (Blueprint $table) {
            if (Schema::hasColumn('delivery_confirmations', 'project_id')) {
                $table->dropConstrainedForeignId('project_id');
            }
        });
    }
};
