<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Agregar empresa_id a lotes para identificar la empresa vendedora
     */
    public function up(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            // Empresa que vende en esta planta
            $table->foreignId('empresa_id')
                ->after('planta_id')
                ->constrained('empresas')
                ->onDelete('restrict');

            // Índice para búsquedas
            $table->index('empresa_id');

            // Un lote es único por combinación planta + empresa
            $table->unique(['planta_id', 'empresa_id', 'numero_lote']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->dropForeign(['empresa_id']);
            $table->dropIndex(['empresa_id']);
            $table->dropUnique(['planta_id', 'empresa_id', 'numero_lote']);
            $table->dropColumn('empresa_id');
        });
    }
};
