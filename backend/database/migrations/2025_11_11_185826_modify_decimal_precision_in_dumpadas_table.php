<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Modificar precisión de columnas decimales en tabla dumpadas
     *
     * PROBLEMA: decimal(8,3) redondeaba valores como 0.0078 a 0.008
     * SOLUCIÓN: decimal(12,6) permite hasta 6 decimales sin redondear
     *
     * EJEMPLOS:
     * - decimal(8,3) permite: 99999.999 (5 enteros, 3 decimales)
     * - decimal(12,6) permite: 999999.999999 (6 enteros, 6 decimales)
     */
    public function up(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            // Modificar ley: de decimal(8,3) a decimal(12,6)
            // Soporta valores desde 0.000001 hasta 999999.999999
            $table->decimal('ley', 12, 6)->nullable()->change();

            // Modificar ley_cup: de decimal(8,3) a decimal(12,6)
            // Mismo rango que ley
            $table->decimal('ley_cup', 12, 6)->nullable()->change();

            // Modificar ley_visual: de varchar(100) a decimal(12,6)
            // RECOMENDACIÓN: Convertir a decimal para poder hacer cálculos
            // Si hay valores no numéricos en BD, esta migración fallará
            // En ese caso, comenta esta línea y mantén varchar
             $table->decimal('ley_visual', 12, 6)->nullable()->change();
            // MANTENIENDO VARCHAR porque hay valores vacíos o no numéricos
        });
    }

    /**
     * Revertir cambios (volver a la estructura original)
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->decimal('ley', 8, 3)->nullable()->change();
            $table->decimal('ley_cup', 8, 3)->nullable()->change();
            $table->string('ley_visual', 100)->nullable()->change();
        });
    }
};
