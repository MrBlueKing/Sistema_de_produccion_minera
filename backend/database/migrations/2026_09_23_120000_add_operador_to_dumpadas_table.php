<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Operador del dumper que hizo la dumpada. Mismo patron que la maquina
     * (id_maquina + nombre_maquina): id externo del sistema de Petroleo
     * (personal_interno.id_personal_interno, sin FK porque es otra BD) + el
     * nombre guardado como foto, para que el dato sobreviva aunque cambie o
     * se borre en Petroleo.
     *
     * Nullable a nivel de BD porque las dumpadas historicas nunca lo
     * registraron. Para dumpadas NUEVAS es obligatorio a nivel de validacion
     * (DumpadaController::bulkStore), no de la BD.
     */
    public function up(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->unsignedBigInteger('id_operador')->nullable()->after('nombre_maquina');
            $table->string('nombre_operador', 150)->nullable()->after('id_operador');
        });
    }

    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn(['id_operador', 'nombre_operador']);
        });
    }
};
