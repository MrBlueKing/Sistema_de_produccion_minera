<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Agrega Fecha/Hora de Carguio y Transporte (CyT), separada de la
     * Fecha/Hora de Extraccion que ya existe (columnas 'fecha'/'hora', sin
     * renombrar -- se usan en demasiados reportes para justificar el riesgo).
     *
     * Nullable a nivel de BD porque las ~1200 dumpadas historicas nunca
     * registraron este dato -- no hay forma honesta de completarlo retroactivo.
     * Para dumpadas NUEVAS, ambas fechas son obligatorias a nivel de
     * validacion de la app (DumpadaController::store), no de la BD.
     */
    public function up(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->date('fecha_cyt')->nullable()->after('hora');
            $table->time('hora_cyt')->nullable()->after('fecha_cyt');
        });
    }

    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn(['fecha_cyt', 'hora_cyt']);
        });
    }
};
