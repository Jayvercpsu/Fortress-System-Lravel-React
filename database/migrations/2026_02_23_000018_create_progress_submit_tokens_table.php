<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('progress_submit_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('foreman_id')->constrained('users')->cascadeOnDelete();
            $table->string('token', 120)->unique();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('last_submitted_at')->nullable();
            $table->unsignedInteger('submission_count')->default(0);
            $table->timestamps();
            $table->index(['project_id', 'foreman_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('progress_submit_tokens');
    }
};
