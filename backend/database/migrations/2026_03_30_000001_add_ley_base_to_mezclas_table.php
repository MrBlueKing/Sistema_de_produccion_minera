<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Agrega ley_base a mezclas para controlar qué fracción de cobre
     * se usa en los cálculos (ley_dump_ajustada, ley_lote).
     *
     * Valores:
     *   'auto'         → usa la más alta entre cu_insoluble y cu_soluble
     *   'cu_insoluble' → usa siempre cu_insoluble
     *   'cu_soluble'   → usa siempre cu_soluble
     *   'cu_total'     → usa la ley completa (comportamiento histórico)
     *
     * Para dumpadas antiguas sin cu_soluble/cu_insoluble siempre se usa ley (legado).
     */
    public function up(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->string('ley_base', 20)
                ->default('auto')
                ->after('ley_lab')
                ->comment('Base de cálculo de ley: auto (mayor), cu_insoluble, cu_soluble, cu_total');
        });
    }

    public function down(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropColumn('ley_base');
        });
    }
};
