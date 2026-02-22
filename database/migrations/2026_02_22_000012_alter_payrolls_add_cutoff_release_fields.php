<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->foreignId('cutoff_id')->nullable()->after('user_id')->constrained('payroll_cutoffs')->nullOnDelete();
            $table->timestamp('released_at')->nullable()->after('status');
            $table->foreignId('released_by')->nullable()->after('released_at')->constrained('users')->nullOnDelete();
            $table->string('payment_reference')->nullable()->after('released_by');
            $table->string('bank_export_ref')->nullable()->after('payment_reference');
        });
    }

    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cutoff_id');
            $table->dropConstrainedForeignId('released_by');
            $table->dropColumn(['released_at', 'payment_reference', 'bank_export_ref']);
        });
    }
};
