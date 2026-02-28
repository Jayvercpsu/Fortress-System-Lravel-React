<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('delivery_confirmations', function (Blueprint $table) {
            if (!Schema::hasColumn('delivery_confirmations', 'photo_path')) {
                $table->string('photo_path')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('delivery_confirmations', function (Blueprint $table) {
            if (Schema::hasColumn('delivery_confirmations', 'photo_path')) {
                $table->dropColumn('photo_path');
            }
        });
    }
};
