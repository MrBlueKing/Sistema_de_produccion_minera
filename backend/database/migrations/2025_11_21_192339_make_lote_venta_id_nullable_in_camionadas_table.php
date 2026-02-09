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
        Schema::table('camionadas', function (Blueprint $table) {
            // Eliminar la restricción de foreign key primero
            $table->dropForeign(['lote_venta_id']);

            // Eliminar la restricción unique
            $table->dropUnique(['lote_venta_id', 'numero_camionada']);

            // Hacer lote_venta_id nullable
            $table->foreignId('lote_venta_id')
                ->nullable()
                ->change();

            // Volver a agregar la foreign key
            $table->foreign('lote_venta_id')
                ->references('id')
                ->on('lotes_venta')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            // Eliminar la foreign key
            $table->dropForeign(['lote_venta_id']);

            // Hacer lote_venta_id NOT NULL de nuevo
            $table->foreignId('lote_venta_id')
                ->nullable(false)
                ->change();

            // Volver a agregar la foreign key y el unique
            $table->foreign('lote_venta_id')
                ->references('id')
                ->on('lotes_venta')
                ->onDelete('cascade');

            $table->unique(['lote_venta_id', 'numero_camionada']);
        });
    }
};
