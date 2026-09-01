<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marca de "reporte corregido" — visible para todos (Ingeniería y Polvorín) sin
 * necesidad de abrir el Historial. Se setea al confirmar una corrección; sirve
 * para que el polvorinero note que un cierre suyo fue tocado, sobre todo si la
 * corrección cambió las devoluciones.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reportes_perforacion', function (Blueprint $table) {
            $table->dateTime('corregido_en')->nullable()->after('correccion_iniciada_en');
            $table->string('corregido_por', 150)->nullable()->after('corregido_en');
            $table->boolean('corregido_toco_devoluciones')->default(false)->after('corregido_por');
        });
    }

    public function down(): void
    {
        Schema::table('reportes_perforacion', function (Blueprint $table) {
            $table->dropColumn(['corregido_en', 'corregido_por', 'corregido_toco_devoluciones']);
        });
    }
};
