<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Modo "corrección" para reportes de Perforación y Tronadura.
 *
 * Corregir un reporte ya Confirmado/Cerrado exige revertir sus movimientos de
 * stock (anular, y reabrir si estaba Cerrado), editar en borrador y volver a
 * confirmar/cerrar. Estas columnas dejan ese proceso encapsulado en un único
 * flujo "Habilitar corrección" y, sobre todo, permiten recuperar un reporte que
 * quedó a medio corregir (navegador cerrado): mientras `en_correccion` es true,
 * `correccion_snapshot` guarda las líneas y devoluciones tal como estaban, así
 * siempre se puede confirmar los cambios o descartar y restaurar el original.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reportes_perforacion', function (Blueprint $table) {
            $table->boolean('en_correccion')->default(false)->after('fecha_confirmacion');
            $table->string('correccion_estado_previo', 20)->nullable()->after('en_correccion');
            $table->json('correccion_snapshot')->nullable()->after('correccion_estado_previo');
            $table->string('correccion_por', 150)->nullable()->after('correccion_snapshot');
            $table->dateTime('correccion_iniciada_en')->nullable()->after('correccion_por');
        });
    }

    public function down(): void
    {
        Schema::table('reportes_perforacion', function (Blueprint $table) {
            $table->dropColumn([
                'en_correccion',
                'correccion_estado_previo',
                'correccion_snapshot',
                'correccion_por',
                'correccion_iniciada_en',
            ]);
        });
    }
};
