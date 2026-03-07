<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'projects',
            'design_projects',
            'build_projects',
            'expenses',
            'project_files',
            'project_updates',
            'project_scopes',
            'scope_photos',
            'progress_submit_tokens',
            'payments',
            'project_assignments',
            'project_workers',
            'attendances',
            'weekly_accomplishments',
            'material_requests',
            'issue_reports',
            'delivery_confirmations',
            'progress_photos',
            'workers',
        ];

        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $tableBlueprint) use ($table) {
                if (!Schema::hasColumn($table, 'deleted_at')) {
                    $tableBlueprint->softDeletes();
                }
            });
        }
    }

    public function down(): void
    {
        $tables = [
            'projects',
            'design_projects',
            'build_projects',
            'expenses',
            'project_files',
            'project_updates',
            'project_scopes',
            'scope_photos',
            'progress_submit_tokens',
            'payments',
            'project_assignments',
            'project_workers',
            'attendances',
            'weekly_accomplishments',
            'material_requests',
            'issue_reports',
            'delivery_confirmations',
            'progress_photos',
            'workers',
        ];

        foreach ($tables as $table) {
            Schema::table($table, function (Blueprint $tableBlueprint) use ($table) {
                if (Schema::hasColumn($table, 'deleted_at')) {
                    $tableBlueprint->dropSoftDeletes();
                }
            });
        }
    }
};
