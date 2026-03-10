<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'source_project_id')) {
                $table->unsignedBigInteger('source_project_id')->nullable()->after('id');
                $table->foreign('source_project_id')
                    ->references('id')
                    ->on('projects')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'source_project_id')) {
                $table->dropForeign(['source_project_id']);
                $table->dropColumn('source_project_id');
            }
        });
    }
};
