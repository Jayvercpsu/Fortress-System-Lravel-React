<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_scopes', function (Blueprint $table) {
            if (!Schema::hasColumn('project_scopes', 'sort_order')) {
                $table->unsignedInteger('sort_order')->nullable()->after('weight_percent');
            }
        });

        DB::table('project_scopes')
            ->whereNull('sort_order')
            ->update(['sort_order' => DB::raw('id')]);
    }

    public function down(): void
    {
        Schema::table('project_scopes', function (Blueprint $table) {
            if (Schema::hasColumn('project_scopes', 'sort_order')) {
                $table->dropColumn('sort_order');
            }
        });
    }
};
