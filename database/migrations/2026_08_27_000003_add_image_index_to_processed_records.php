<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('processed_records', function (Blueprint $table) {
            $table->unsignedInteger('image_index')->nullable()->after('record_type');
        });
    }

    public function down(): void
    {
        Schema::table('processed_records', function (Blueprint $table) {
            $table->dropColumn('image_index');
        });
    }
};
