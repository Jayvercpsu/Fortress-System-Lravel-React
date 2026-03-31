<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('design_projects', function (Blueprint $table) {
            if (!Schema::hasColumn('design_projects', 'work_started_at')) {
                $table->date('work_started_at')->nullable()->after('design_progress');
            }

            if (!Schema::hasColumn('design_projects', 'work_completed_at')) {
                $table->date('work_completed_at')->nullable()->after('work_started_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('design_projects', function (Blueprint $table) {
            $dropColumns = [];

            if (Schema::hasColumn('design_projects', 'work_started_at')) {
                $dropColumns[] = 'work_started_at';
            }

            if (Schema::hasColumn('design_projects', 'work_completed_at')) {
                $dropColumns[] = 'work_completed_at';
            }

            if (!empty($dropColumns)) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
