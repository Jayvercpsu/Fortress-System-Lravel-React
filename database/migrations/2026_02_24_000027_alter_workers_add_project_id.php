<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            if (!Schema::hasColumn('workers', 'project_id')) {
                $table->foreignId('project_id')->nullable()->after('foreman_id')->constrained()->nullOnDelete();
                $table->index(['foreman_id', 'project_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('workers', function (Blueprint $table) {
            if (Schema::hasColumn('workers', 'project_id')) {
                $table->dropConstrainedForeignId('project_id');
            }
        });
    }
};
