<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            if (!Schema::hasColumn('attendances', 'project_id')) {
                $table->foreignId('project_id')->nullable()->after('foreman_id')->constrained('projects')->nullOnDelete();
            }

            if (!Schema::hasColumn('attendances', 'time_in')) {
                $table->time('time_in')->nullable()->after('date');
            }

            if (!Schema::hasColumn('attendances', 'time_out')) {
                $table->time('time_out')->nullable()->after('time_in');
            }

            if (!Schema::hasColumn('attendances', 'selfie_path')) {
                $table->string('selfie_path')->nullable()->after('hours');
            }
        });
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            if (Schema::hasColumn('attendances', 'project_id')) {
                $table->dropConstrainedForeignId('project_id');
            }

            if (Schema::hasColumn('attendances', 'time_out')) {
                $table->dropColumn('time_out');
            }

            if (Schema::hasColumn('attendances', 'time_in')) {
                $table->dropColumn('time_in');
            }

            if (Schema::hasColumn('attendances', 'selfie_path')) {
                $table->dropColumn('selfie_path');
            }
        });
    }
};
