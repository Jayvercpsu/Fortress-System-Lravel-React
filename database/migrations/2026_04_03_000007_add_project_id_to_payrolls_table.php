<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            if (!Schema::hasColumn('payrolls', 'project_id')) {
                $table->foreignId('project_id')
                    ->nullable()
                    ->after('cutoff_id')
                    ->constrained('projects')
                    ->nullOnDelete();
                $table->index(['project_id', 'cutoff_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            if (Schema::hasColumn('payrolls', 'project_id')) {
                $table->dropConstrainedForeignId('project_id');
                $table->dropIndex(['project_id', 'cutoff_id']);
            }
        });
    }
};

