<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monitoring_board_items', function (Blueprint $table) {
            if (!Schema::hasColumn('monitoring_board_items', 'design_contract_amount')) {
                $table->decimal('design_contract_amount', 12, 2)->nullable()->after('remarks');
            }
            if (!Schema::hasColumn('monitoring_board_items', 'downpayment')) {
                $table->decimal('downpayment', 12, 2)->nullable()->after('design_contract_amount');
            }
            if (!Schema::hasColumn('monitoring_board_items', 'total_received')) {
                $table->decimal('total_received', 12, 2)->nullable()->after('downpayment');
            }
            if (!Schema::hasColumn('monitoring_board_items', 'office_payroll_deduction')) {
                $table->decimal('office_payroll_deduction', 12, 2)->nullable()->after('total_received');
            }
            if (!Schema::hasColumn('monitoring_board_items', 'client_approval_status')) {
                $table->string('client_approval_status', 20)->nullable()->after('office_payroll_deduction');
            }
        });
    }

    public function down(): void
    {
        Schema::table('monitoring_board_items', function (Blueprint $table) {
            if (Schema::hasColumn('monitoring_board_items', 'client_approval_status')) {
                $table->dropColumn('client_approval_status');
            }
            if (Schema::hasColumn('monitoring_board_items', 'office_payroll_deduction')) {
                $table->dropColumn('office_payroll_deduction');
            }
            if (Schema::hasColumn('monitoring_board_items', 'total_received')) {
                $table->dropColumn('total_received');
            }
            if (Schema::hasColumn('monitoring_board_items', 'downpayment')) {
                $table->dropColumn('downpayment');
            }
            if (Schema::hasColumn('monitoring_board_items', 'design_contract_amount')) {
                $table->dropColumn('design_contract_amount');
            }
        });
    }
};
