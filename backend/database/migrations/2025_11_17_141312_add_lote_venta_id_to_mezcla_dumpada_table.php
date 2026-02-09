<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            // Agregar relación con lotes_venta para remanentes
            // Si tipo='REM', este campo indica de qué lote de venta proviene el remanente
            $table->foreignId('lote_venta_id')
                ->nullable()
                ->after('dumpada_id')
                ->constrained('lotes_venta')
                ->onDelete('set null');

            // Índice para búsquedas
            $table->index('lote_venta_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            $table->dropForeign(['lote_venta_id']);
            $table->dropIndex(['lote_venta_id']);
            $table->dropColumn('lote_venta_id');
        });
    }
};
