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
        Schema::create('rangos', function (Blueprint $table) {
            $table->id();
            $table->string('nomenclatura', 20); // A, B, C, D, E, F, G, H, I, J, K, L, Reserva, Descarte
            $table->decimal('limite_inferior', 5, 2); // 0.00%
            $table->decimal('limite_superior', 5, 2); // 99.99%
            $table->decimal('amplitud', 5, 2); // Diferencia entre límites
            $table->string('descripcion', 100)->nullable(); // Descripción adicional
            $table->integer('orden')->default(0); // Para ordenar los rangos
            $table->timestamps();

            // Índice para búsquedas rápidas por nomenclatura
            $table->index('nomenclatura');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rangos');
    }
};
