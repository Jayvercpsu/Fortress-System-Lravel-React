<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('progress_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('foreman_id')->constrained('users')->onDelete('cascade');
            $table->string('photo_path');
            $table->text('caption')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('progress_photos'); }
};