<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Agregar lote_id a camionadas para agrupar despachos
     */
    public function up(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            // Agregar lote_id (opcional, permite camionadas sueltas)
            $table->foreignId('lote_id')
                ->nullable()
                ->after('id')
                ->constrained('lotes')
                ->onDelete('set null');

            // Cambiar cliente a nullable (ahora puede venir del lote)
            if (Schema::hasColumn('camionadas', 'cliente')) {
                $table->string('cliente', 150)->nullable()->change();
            }

            // Índice
            $table->index('lote_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            $table->dropForeign(['lote_id']);
            $table->dropIndex(['lote_id']);
            $table->dropColumn('lote_id');
        });
    }
};
