<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('concierge_logs', function (Blueprint $table) {
            $table->id();
            $table->string('session_id')->nullable();
            $table->text('user_message');
            $table->string('tool_called')->nullable();
            $table->string('search_query')->nullable();
            $table->text('ai_response')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('concierge_logs');
    }
};
