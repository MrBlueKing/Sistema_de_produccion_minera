<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Agrega soporte para configuraciones por faena
     */
    public function up(): void
    {
        Schema::table('configuraciones_sistema', function (Blueprint $table) {
            // Agregar columna id_faena nullable despues de clave
            $table->unsignedBigInteger('id_faena')->nullable()->after('clave');

            // Eliminar indice unico actual de solo 'clave'
            $table->dropUnique(['clave']);

            // Crear nuevo indice unico compuesto (clave + id_faena)
            // Esto permite: ('tonelaje_dumpada_default', NULL) para global
            //               ('tonelaje_dumpada_default', 1) para faena 1
            //               ('tonelaje_dumpada_default', 2) para faena 2
            $table->unique(['clave', 'id_faena'], 'configuraciones_clave_faena_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('configuraciones_sistema', function (Blueprint $table) {
            // Eliminar indice compuesto
            $table->dropUnique('configuraciones_clave_faena_unique');

            // Restaurar indice unico de solo clave
            $table->unique(['clave']);

            // Eliminar columna id_faena
            $table->dropColumn('id_faena');
        });
    }
};
