<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // SQLite (tests) does not enforce ENUM values; only MySQL needs the
        // column altered.
        if (DB::getDriverName() !== 'mysql') {
            $this->write('Skipping severity enum change (non-MySQL driver).');

            return;
        }

        DB::statement(
            "ALTER TABLE issue_reports MODIFY COLUMN severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium'"
        );
        $this->write("Extended issue_reports.severity with 'critical'.");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        // Map critical rows back so the narrower ENUM accepts existing data.
        DB::table('issue_reports')
            ->where('severity', 'critical')
            ->update(['severity' => 'high']);

        DB::statement(
            "ALTER TABLE issue_reports MODIFY COLUMN severity ENUM('low','medium','high') NOT NULL DEFAULT 'medium'"
        );
        $this->write("Reverted issue_reports.severity to low/medium/high.");
    }

    private function write(string $message): void
    {
        if (!app()->runningInConsole() || app()->runningUnitTests()) {
            return;
        }

        fwrite(STDOUT, $message.PHP_EOL);
    }
};
