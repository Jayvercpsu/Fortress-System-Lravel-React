<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        $enumDefinition = "ENUM('Design','Construction','Completed')";

        DB::statement("UPDATE projects SET phase = CASE\n            WHEN LOWER(TRIM(COALESCE(phase, ''))) = 'construction' THEN 'Construction'\n            WHEN LOWER(TRIM(COALESCE(phase, ''))) = 'completed' THEN 'Completed'\n            ELSE 'Design'\n        END");

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE projects MODIFY phase {$enumDefinition} NOT NULL DEFAULT 'Design'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE projects ALTER COLUMN phase TYPE VARCHAR(20)");
            DB::statement("ALTER TABLE projects ADD CONSTRAINT projects_phase_check CHECK (phase IN ('Design','Construction','Completed'))");
            DB::statement("ALTER TABLE projects ALTER COLUMN phase SET DEFAULT 'Design'");
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE projects MODIFY phase VARCHAR(255) NOT NULL DEFAULT 'Design'");
        } elseif ($driver === 'pgsql') {
            DB::statement("ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_phase_check");
            DB::statement("ALTER TABLE projects ALTER COLUMN phase TYPE VARCHAR(255)");
            DB::statement("ALTER TABLE projects ALTER COLUMN phase SET DEFAULT 'Design'");
        }
    }
};
