<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('design_projects', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id')->unique();
            $table->decimal('design_contract_amount', 15, 2)->default(0);
            $table->decimal('downpayment', 15, 2)->default(0);
            $table->decimal('total_received', 15, 2)->default(0);
            $table->decimal('office_payroll_deduction', 15, 2)->default(0);
            $table->unsignedTinyInteger('design_progress')->default(0);
            $table->enum('client_approval_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('design_projects');
    }
};
