<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('client');
            $table->string('type');
            $table->string('location');
            $table->string('assigned')->nullable();
            $table->date('target')->nullable();
            $table->string('status')->default('PLANNING');
            $table->string('phase')->default('DESIGN');
            $table->unsignedTinyInteger('overall_progress')->default(0);
            $table->decimal('contract_amount', 15, 2)->default(0);
            $table->decimal('design_fee', 15, 2)->default(0);
            $table->decimal('construction_cost', 15, 2)->default(0);
            $table->decimal('total_client_payment', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
