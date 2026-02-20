<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('foreman_id')->constrained('users')->onDelete('cascade');
            $table->string('worker_name');
            $table->string('worker_role');
            $table->date('date');
            $table->decimal('hours', 5, 1)->default(0);
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('attendances'); }
};