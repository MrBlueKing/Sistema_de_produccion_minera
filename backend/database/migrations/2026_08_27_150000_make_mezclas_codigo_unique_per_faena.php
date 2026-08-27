<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El código de mezcla lo numera cada faena por su cuenta (Cabildo y Catemu
 * llevan secuencias independientes), así que puede coincidir el mismo texto
 * entre faenas sin ser el mismo dato — pero la tabla tenía `codigo` con
 * unique() GLOBAL, no por faena. Esto hizo fallar la importación de Cabildo
 * del 27-ago-2026 al chocar con códigos ya usados por Catemu (CZ1623) o sin
 * faena asignada (CZ1631), aunque no eran duplicados reales de Cabildo.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropUnique('mezclas_codigo_unique');
            $table->unique(['codigo', 'id_faena'], 'mezclas_codigo_id_faena_unique');
        });
    }

    public function down(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropUnique('mezclas_codigo_id_faena_unique');
            $table->unique('codigo', 'mezclas_codigo_unique');
        });
    }
};
