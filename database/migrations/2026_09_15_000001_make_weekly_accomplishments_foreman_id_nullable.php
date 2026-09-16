<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            $this->rebuildSqliteTable(true);
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE `weekly_accomplishments` MODIFY `foreman_id` BIGINT UNSIGNED NULL');
            return;
        }

        Schema::table('weekly_accomplishments', function (Blueprint $table) {
            if (Schema::hasColumn('weekly_accomplishments', 'foreman_id')) {
                $table->unsignedBigInteger('foreman_id')->nullable()->change();
            }
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            $this->rebuildSqliteTable(false);
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE `weekly_accomplishments` MODIFY `foreman_id` BIGINT UNSIGNED NOT NULL');
            return;
        }

        Schema::table('weekly_accomplishments', function (Blueprint $table) {
            if (Schema::hasColumn('weekly_accomplishments', 'foreman_id')) {
                $table->unsignedBigInteger('foreman_id')->nullable(false)->change();
            }
        });
    }

    private function rebuildSqliteTable(bool $foremanNullable): void
    {
        $nullability = $foremanNullable ? 'null' : 'not null';

        DB::beginTransaction();
        DB::statement('PRAGMA foreign_keys = OFF');

        try {
            DB::statement("
                CREATE TABLE weekly_accomplishments_temp_rebuild (
                    id integer primary key autoincrement not null,
                    foreman_id integer {$nullability} REFERENCES \"users\" (\"id\") ON DELETE CASCADE,
                    project_id integer null REFERENCES \"projects\" (\"id\") ON DELETE SET NULL,
                    submitted_by integer null REFERENCES \"users\" (\"id\") ON DELETE SET NULL,
                    scope_of_work varchar not null,
                    percent_completed numeric default 0,
                    week_start date not null,
                    is_placeholder boolean default 0,
                    created_at datetime null,
                    updated_at datetime null,
                    deleted_at datetime null
                )
            ");

            DB::statement('
                INSERT INTO weekly_accomplishments_temp_rebuild
                    (id, foreman_id, project_id, submitted_by, scope_of_work, percent_completed, week_start, is_placeholder, created_at, updated_at, deleted_at)
                SELECT id, foreman_id, project_id, submitted_by, scope_of_work, percent_completed, week_start, is_placeholder, created_at, updated_at, deleted_at
                FROM weekly_accomplishments
            ');

            DB::statement('DROP TABLE weekly_accomplishments');
            DB::statement('ALTER TABLE weekly_accomplishments_temp_rebuild RENAME TO weekly_accomplishments');
            DB::statement('PRAGMA foreign_keys = ON');
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            DB::statement('PRAGMA foreign_keys = ON');
            throw $e;
        }
    }
};
