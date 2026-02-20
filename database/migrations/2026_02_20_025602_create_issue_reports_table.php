<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('issue_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('foreman_id')->constrained('users')->onDelete('cascade');
            $table->string('issue_title');
            $table->text('description');
            $table->enum('severity', ['low', 'medium', 'high'])->default('medium');
            $table->enum('status', ['open', 'resolved'])->default('open');
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('issue_reports'); }
};