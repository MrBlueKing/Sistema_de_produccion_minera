<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La fecha principal de la dumpada (`fecha`, la que usan Laboratorio, el
 * certificado, filtros, orden y gráficos) pasa a ser la del CyT — el día en
 * que el dumper saca el material. La fecha real de extracción/tronadura, que
 * puede ser días antes, queda en la columna nueva `fecha_extraccion`.
 *
 * Solo se mueven las dumpadas con CyT distinto a su fecha (ingresadas desde
 * el 29-09-2026). Las anteriores no tienen CyT y quedan igual.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->date('fecha_extraccion')->nullable()->after('hora_cyt')
                ->comment('Fecha real de extracción/tronadura (puede ser días antes del CyT). La fecha principal es la del CyT.');
            $table->time('hora_extraccion')->nullable()->after('fecha_extraccion');
        });

        // Dumpadas con CyT: la fecha actual era la de extracción -> guardarla
        // aparte y dejar la del CyT como principal (y su hora).
        DB::statement("
            UPDATE dumpadas
            SET fecha_extraccion = fecha,
                fecha = fecha_cyt,
                hora = COALESCE(hora_cyt, hora)
            WHERE fecha_cyt IS NOT NULL
        ");
    }

    public function down(): void
    {
        DB::statement("
            UPDATE dumpadas
            SET fecha = fecha_extraccion
            WHERE fecha_extraccion IS NOT NULL
        ");

        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn(['fecha_extraccion', 'hora_extraccion']);
        });
    }
};
