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
        Schema::create('frentes_trabajo', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100);
            $table->foreignId('id_tipo_frente')
                  ->constrained('tipos_frente')
                  ->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('frentes_trabajo');
    }
};
