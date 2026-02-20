<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('weekly_accomplishments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('foreman_id')->constrained('users')->onDelete('cascade');
            $table->string('scope_of_work');
            $table->decimal('percent_completed', 5, 2)->default(0);
            $table->date('week_start');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('weekly_accomplishments'); }
};