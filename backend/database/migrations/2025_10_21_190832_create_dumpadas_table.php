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
        Schema::create('dumpadas', function (Blueprint $table) {
            $table->id();

            // Relación con frentes_trabajo (PUNTO)
            $table->foreignId('id_frente_trabajo')
                ->constrained('frentes_trabajo')
                ->onDelete('cascade');

            // Campos del Excel
            $table->string('n_acop', 50)->nullable();     // N°Acop
            $table->string('acopios', 100)->nullable();   // Acopios
            $table->string('jornada', 50)->nullable();    // jornada
            $table->date('fecha')->nullable();            // fecha
            $table->decimal('ton', 8, 2)->nullable();     // toneladas
            $table->decimal('ley', 8, 3)->nullable();     // ley
            $table->decimal('ley_cup', 8, 3)->nullable(); // ley Cup
            $table->string('certificado', 100)->nullable();
            $table->string('columna1', 100)->nullable();
            $table->string('ley_visual', 100)->nullable();
            $table->string('rango', 100)->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('dumpadas');
    }
};
