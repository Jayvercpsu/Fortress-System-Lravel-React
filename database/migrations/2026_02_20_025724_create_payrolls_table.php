<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('payrolls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('worker_name');
            $table->string('role');
            $table->decimal('hours', 8, 2);
            $table->decimal('rate_per_hour', 10, 2);
            $table->decimal('gross', 10, 2);
            $table->decimal('deductions', 10, 2)->default(0);
            $table->decimal('net', 10, 2);
            $table->enum('status', ['pending', 'ready', 'approved', 'paid'])->default('pending');
            $table->date('week_start');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('payrolls'); }
};