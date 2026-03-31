<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $roles = ['head_admin', 'admin', 'hr', 'foreman', 'client', 'designer'];

        if (DB::getDriverName() === 'sqlite') {
            $this->recreateSqliteUsersTable($roles);
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            $this->syncMysqlRoleEnum($roles);
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'role')) {
                $table->string('role', 50)->change();
            }
        });
    }

    public function down(): void
    {
        $targetRoles = ['head_admin', 'admin', 'hr', 'foreman', 'client'];
        DB::table('users')->where('role', 'designer')->update(['role' => 'foreman']);

        if (DB::getDriverName() === 'sqlite') {
            $this->recreateSqliteUsersTable($targetRoles);
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            $this->syncMysqlRoleEnum($targetRoles);
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'role')) {
                $table->string('role', 50)->change();
            }
        });
    }

    private function syncMysqlRoleEnum(array $roles): void
    {
        $quoted = collect($roles)
            ->map(fn (string $role) => "'" . str_replace("'", "''", $role) . "'")
            ->implode(',');

        DB::statement("ALTER TABLE `users` MODIFY `role` ENUM({$quoted}) NOT NULL");
    }

    private function recreateSqliteUsersTable(array $roles): void
    {
        $roleList = collect($roles)
            ->map(fn (string $role) => "'" . str_replace("'", "''", $role) . "'")
            ->implode(',');

        $existingColumns = Schema::getColumnListing('users');
        $hasUsernameColumn = in_array('username', $existingColumns, true);
        $hasDefaultRateColumn = in_array('default_rate_per_hour', $existingColumns, true);

        DB::beginTransaction();
        DB::statement('PRAGMA foreign_keys = OFF');

        try {
            $columns = [
                'id integer primary key autoincrement not null',
                'fullname varchar not null',
                $hasUsernameColumn ? 'username varchar(80) null unique' : null,
                'email varchar null unique',
                'password varchar not null',
                "role varchar not null check (role in ({$roleList}))",
                $hasDefaultRateColumn ? 'default_rate_per_hour numeric null' : null,
                'created_at datetime null',
                'updated_at datetime null',
            ];

            $columnsSql = implode(",\n", array_filter($columns));
            DB::statement("CREATE TABLE users_temp_rebuild ({$columnsSql})");

            $insertColumns = ['id', 'fullname'];
            $selectColumns = ['id', 'fullname'];

            if ($hasUsernameColumn) {
                $insertColumns[] = 'username';
                $selectColumns[] = 'username';
            }

            $insertColumns[] = 'email';
            $selectColumns[] = 'email';
            $insertColumns[] = 'password';
            $selectColumns[] = 'password';
            $insertColumns[] = 'role';
            $selectColumns[] = 'role';

            if ($hasDefaultRateColumn) {
                $insertColumns[] = 'default_rate_per_hour';
                $selectColumns[] = 'default_rate_per_hour';
            }

            $insertColumns[] = 'created_at';
            $insertColumns[] = 'updated_at';
            $selectColumns[] = 'created_at';
            $selectColumns[] = 'updated_at';

            $insertSql = implode(', ', $insertColumns);
            $selectSql = implode(', ', $selectColumns);

            DB::statement("
                INSERT INTO users_temp_rebuild ({$insertSql})
                SELECT {$selectSql}
                FROM users
            ");

            DB::statement('DROP TABLE users');
            DB::statement('ALTER TABLE users_temp_rebuild RENAME TO users');
            DB::statement('PRAGMA foreign_keys = ON');
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            DB::statement('PRAGMA foreign_keys = ON');
            throw $e;
        }
    }
};
