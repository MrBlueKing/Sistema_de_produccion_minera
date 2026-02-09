<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Agrega campo numero_jornada para llevar un contador secuencial
     * por cada combinación de: frente_trabajo + jornada + fecha
     */
    public function up(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->unsignedInteger('numero_jornada')->nullable()->after('jornada');

            // Índice compuesto para búsquedas rápidas
            $table->index(['id_frente_trabajo', 'jornada', 'fecha'], 'idx_frente_jornada_fecha');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropIndex('idx_frente_jornada_fecha');
            $table->dropColumn('numero_jornada');
        });
    }
};
