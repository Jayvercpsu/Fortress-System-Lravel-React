<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            if (!Schema::hasColumn('payrolls', 'project_name')) {
                $table->string('project_name')->nullable()->after('project_id');
            }
            if (!Schema::hasColumn('payrolls', 'project_client')) {
                $table->string('project_client')->nullable()->after('project_name');
            }
        });

        if (Schema::hasTable('projects') && Schema::hasTable('payrolls')) {
            // Correlated subqueries keep this portable across MySQL and SQLite
            // (SQLite cannot resolve joined table columns in an UPDATE ... SET).
            DB::table('payrolls')
                ->whereNotNull('project_id')
                ->update([
                    'project_name' => DB::raw('(select name from projects where projects.id = payrolls.project_id)'),
                    'project_client' => DB::raw('(select client from projects where projects.id = payrolls.project_id)'),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            if (Schema::hasColumn('payrolls', 'project_client')) {
                $table->dropColumn('project_client');
            }
            if (Schema::hasColumn('payrolls', 'project_name')) {
                $table->dropColumn('project_name');
            }
        });
    }
};
