<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('material_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('foreman_id')->constrained('users')->onDelete('cascade');
            $table->string('material_name');
            $table->string('quantity');
            $table->string('unit');
            $table->text('remarks')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('material_requests'); }
};