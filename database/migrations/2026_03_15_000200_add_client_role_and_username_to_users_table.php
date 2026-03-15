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
            $this->recreateSqliteUsersTable(
                ['head_admin', 'admin', 'hr', 'foreman', 'client'],
                true
            );

            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'username')) {
                $table->string('username', 80)->nullable()->unique()->after('fullname');
            }
        });

        $this->syncRoleEnum(['head_admin', 'admin', 'hr', 'foreman', 'client']);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            $this->recreateSqliteUsersTable(
                ['head_admin', 'admin', 'hr', 'foreman'],
                false
            );

            return;
        }

        $this->syncRoleEnum(['head_admin', 'admin', 'hr', 'foreman']);

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'username')) {
                $table->dropUnique('users_username_unique');
                $table->dropColumn('username');
            }
        });
    }

    private function syncRoleEnum(array $roles): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $quoted = collect($roles)
            ->map(fn (string $role) => "'" . str_replace("'", "''", $role) . "'")
            ->implode(',');

        DB::statement("ALTER TABLE `users` MODIFY `role` ENUM({$quoted}) NOT NULL");
    }

    private function recreateSqliteUsersTable(array $roles, bool $includeUsername): void
    {
        $roleList = collect($roles)
            ->map(fn (string $role) => "'" . str_replace("'", "''", $role) . "'")
            ->implode(',');

        $existingColumns = Schema::getColumnListing('users');
        $hasUsernameColumn = in_array('username', $existingColumns, true);

        DB::beginTransaction();
        DB::statement('PRAGMA foreign_keys = OFF');

        try {
            if ($includeUsername) {
                DB::statement("
                    CREATE TABLE users_temp_rebuild (
                        id integer primary key autoincrement not null,
                        fullname varchar not null,
                        username varchar(80) null unique,
                        email varchar not null unique,
                        password varchar not null,
                        role varchar not null check (role in ({$roleList})),
                        created_at datetime null,
                        updated_at datetime null
                    )
                ");

                $usernameSelect = $hasUsernameColumn ? 'username' : 'NULL';

                DB::statement("
                    INSERT INTO users_temp_rebuild (id, fullname, username, email, password, role, created_at, updated_at)
                    SELECT id, fullname, {$usernameSelect}, email, password, role, created_at, updated_at
                    FROM users
                ");
            } else {
                DB::statement("
                    CREATE TABLE users_temp_rebuild (
                        id integer primary key autoincrement not null,
                        fullname varchar not null,
                        email varchar not null unique,
                        password varchar not null,
                        role varchar not null check (role in ({$roleList})),
                        created_at datetime null,
                        updated_at datetime null
                    )
                ");

                DB::statement("
                    INSERT INTO users_temp_rebuild (id, fullname, email, password, role, created_at, updated_at)
                    SELECT id, fullname, email, password, role, created_at, updated_at
                    FROM users
                ");
            }

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
