<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scope_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_scope_id')->constrained('project_scopes')->cascadeOnDelete();
            $table->string('photo_path');
            $table->string('caption')->nullable();
            $table->timestamps();
            $table->index('project_scope_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scope_photos');
    }
};
