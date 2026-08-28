<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('processed_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('record_type');
            $table->string('image_path')->nullable();
            $table->text('ocr_raw_text')->nullable();
            $table->text('ai_parsed_data')->nullable();
            $table->text('ai_summary')->nullable();
            $table->string('ai_model')->nullable();
            $table->string('status')->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'record_type']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('processed_records');
    }
};
