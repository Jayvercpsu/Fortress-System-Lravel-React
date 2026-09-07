<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('weekly_accomplishments', function (Blueprint $table) {
            if (! Schema::hasColumn('weekly_accomplishments', 'submitted_by')) {
                $table->unsignedBigInteger('submitted_by')->nullable()->after('foreman_id');
                $table->foreign('submitted_by')->references('id')->on('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('weekly_accomplishments', function (Blueprint $table) {
            if (Schema::hasColumn('weekly_accomplishments', 'submitted_by')) {
                $table->dropConstrainedForeignId('submitted_by');
            }
        });
    }
};
