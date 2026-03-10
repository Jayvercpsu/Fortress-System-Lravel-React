<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('monitoring_board_files', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('monitoring_board_item_id');
            $table->string('file_path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->timestamps();

            $table->foreign('monitoring_board_item_id')
                ->references('id')
                ->on('monitoring_board_items')
                ->cascadeOnDelete();
            $table->foreign('uploaded_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monitoring_board_files');
    }
};
