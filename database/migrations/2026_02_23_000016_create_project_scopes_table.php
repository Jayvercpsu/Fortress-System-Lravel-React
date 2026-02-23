<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_scopes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('scope_name');
            $table->string('assigned_personnel')->nullable();
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->string('status')->default('NOT_STARTED');
            $table->text('remarks')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_scopes');
    }
};
