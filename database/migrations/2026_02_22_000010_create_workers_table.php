<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('foreman_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->date('birth_date')->nullable();
            $table->string('place_of_birth')->nullable();
            $table->string('sex', 20)->nullable();
            $table->string('civil_status', 100)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('address', 500)->nullable();
            $table->timestamps();

            $table->index(['foreman_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workers');
    }
};
