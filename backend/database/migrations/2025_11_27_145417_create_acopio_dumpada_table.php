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
        Schema::create('acopio_dumpada', function (Blueprint $table) {
            $table->id();

            // Relación con acopios
            $table->foreignId('acopio_id')
                ->constrained('acopios')
                ->onDelete('cascade');

            // Relación con dumpadas
            $table->foreignId('dumpada_id')
                ->constrained('dumpadas')
                ->onDelete('cascade');

            $table->timestamps();

            // Índice único: una dumpada solo puede estar en un acopio
            $table->unique('dumpada_id');

            // Índice para búsquedas por acopio
            $table->index('acopio_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('acopio_dumpada');
    }
};
