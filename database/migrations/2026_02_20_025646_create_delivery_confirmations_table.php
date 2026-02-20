<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('delivery_confirmations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('foreman_id')->constrained('users')->onDelete('cascade');
            $table->string('item_delivered');
            $table->string('quantity');
            $table->date('delivery_date');
            $table->string('supplier')->nullable();
            $table->enum('status', ['received', 'incomplete', 'rejected'])->default('received');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('delivery_confirmations'); }
};