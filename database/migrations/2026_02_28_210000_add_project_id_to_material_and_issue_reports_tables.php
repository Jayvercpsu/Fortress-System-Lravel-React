<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('material_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('material_requests', 'project_id')) {
                $table->foreignId('project_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('projects')
                    ->nullOnDelete();
            }
        });

        Schema::table('issue_reports', function (Blueprint $table) {
            if (!Schema::hasColumn('issue_reports', 'project_id')) {
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
        Schema::table('material_requests', function (Blueprint $table) {
            if (Schema::hasColumn('material_requests', 'project_id')) {
                $table->dropConstrainedForeignId('project_id');
            }
        });

        Schema::table('issue_reports', function (Blueprint $table) {
            if (Schema::hasColumn('issue_reports', 'project_id')) {
                $table->dropConstrainedForeignId('project_id');
            }
        });
    }
};

