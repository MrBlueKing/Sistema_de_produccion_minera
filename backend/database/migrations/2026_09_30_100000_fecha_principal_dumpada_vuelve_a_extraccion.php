<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La fecha principal de la dumpada (`fecha`) vuelve a ser la de Extracción:
 * el paréntesis de la hoja de Dispatch ("PM 29.09"), que es con la que se arma
 * el código que va escrito en la bolsa de la muestra. Así fue siempre hasta el
 * 29-09-2026, cuando pasó a ser la del CyT. El CyT (fecha de arriba de la hoja
 * y hora de la vuelta del dumper) sigue en `fecha_cyt` / `hora_cyt`, y la hora
 * estimada de extracción en `hora_extraccion`.
 *
 * Regla para las filas existentes: `fecha` queda igual a la fecha que dice su
 * código. Las que se numeraron por CyT (29 y 30-09) ya cumplen y no se tocan;
 * las que tienen el código por Extracción recuperan esa fecha.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            UPDATE dumpadas
            SET fecha = fecha_extraccion
            WHERE fecha_extraccion IS NOT NULL
              AND fecha_extraccion <> fecha
              AND acopios LIKE CONCAT('% ', DATE_FORMAT(fecha_extraccion, '%d.%m.%Y'), ' %')
        ");

        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn('fecha_extraccion');
        });
    }

    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->date('fecha_extraccion')->nullable()->after('hora_cyt')
                ->comment('Fecha real de extracción/tronadura (puede ser días antes del CyT). La fecha principal es la del CyT.');
        });

        // Vuelve al esquema anterior (fecha principal = CyT). La fecha de
        // Extracción de las filas numeradas por CyT no se puede recuperar.
        DB::statement("
            UPDATE dumpadas
            SET fecha_extraccion = fecha,
                fecha = fecha_cyt
            WHERE fecha_cyt IS NOT NULL
        ");
    }
};
