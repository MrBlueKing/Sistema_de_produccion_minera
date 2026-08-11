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
        Schema::table('lotes', function (Blueprint $table) {
            // Nunca existió un campo que guardara cuándo se cerró realmente un
            // lote (solo fecha_creacion y los timestamps automáticos de la fila).
            // Se llena desde Lote::cerrar() de acá en adelante — los lotes ya
            // cerrados quedan con este campo en null; el backend sigue usando el
            // proxy (última camionada recepcionada) para esos casos viejos.
            $table->date('fecha_cierre')->nullable()->after('estado');
            $table->index('fecha_cierre');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->dropIndex(['fecha_cierre']);
            $table->dropColumn('fecha_cierre');
        });
    }
};
