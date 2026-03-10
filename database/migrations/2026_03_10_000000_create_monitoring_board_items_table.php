<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monitoring_board_items', function (Blueprint $table) {
            $table->id();
            $table->string('department')->default('General');
            $table->string('client_name');
            $table->string('project_name');
            $table->string('project_type');
            $table->string('location');
            $table->string('assigned_to')->nullable();
            $table->string('status')->default('PROPOSAL');
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->text('remarks')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('project_id')->references('id')->on('projects')->nullOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monitoring_board_items');
    }
};
