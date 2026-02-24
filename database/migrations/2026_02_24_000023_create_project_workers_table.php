<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_workers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('worker_name')->nullable();
            $table->decimal('rate', 12, 2)->default(0);
            $table->timestamps();

            $table->index(['project_id', 'user_id']);
            $table->index(['project_id', 'worker_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_workers');
    }
};
