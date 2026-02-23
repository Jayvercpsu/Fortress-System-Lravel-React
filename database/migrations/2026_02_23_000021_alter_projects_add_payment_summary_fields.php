<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'remaining_balance')) {
                $table->decimal('remaining_balance', 15, 2)->default(0)->after('total_client_payment');
            }

            if (!Schema::hasColumn('projects', 'last_paid_date')) {
                $table->date('last_paid_date')->nullable()->after('remaining_balance');
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'last_paid_date')) {
                $table->dropColumn('last_paid_date');
            }

            if (Schema::hasColumn('projects', 'remaining_balance')) {
                $table->dropColumn('remaining_balance');
            }
        });
    }
};
