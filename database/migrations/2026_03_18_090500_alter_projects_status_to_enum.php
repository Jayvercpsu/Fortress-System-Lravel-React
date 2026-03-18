<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        $enumDefinition = "ENUM('PLANNING','ACTIVE','ONGOING','ON_HOLD','DELAYED','COMPLETED','CANCELLED')";

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE projects MODIFY status {$enumDefinition} NOT NULL DEFAULT 'PLANNING'");
        } elseif ($driver === 'pgsql') {
            // Drop existing check if any, then add the enum-like check constraint
            DB::statement("ALTER TABLE projects ALTER COLUMN status TYPE VARCHAR(20)");
            DB::statement("ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN ('PLANNING','ACTIVE','ONGOING','ON_HOLD','DELAYED','COMPLETED','CANCELLED'))");
            DB::statement("ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'PLANNING'");
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE projects MODIFY status VARCHAR(255) NOT NULL DEFAULT 'PLANNING'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check");
            DB::statement("ALTER TABLE projects ALTER COLUMN status TYPE VARCHAR(255)");
            DB::statement("ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'PLANNING'");
        }
    }
};
