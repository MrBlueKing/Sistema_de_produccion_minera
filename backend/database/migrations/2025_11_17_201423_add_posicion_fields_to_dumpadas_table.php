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
        Schema::table('dumpadas', function (Blueprint $table) {
            // Posición X en el mapa (coordenada horizontal)
            $table->decimal('posicion_x', 10, 2)->nullable()->after('rango');

            // Posición Y en el mapa (coordenada vertical)
            $table->decimal('posicion_y', 10, 2)->nullable()->after('posicion_x');

            // Zona a la que pertenece (opcional, para agrupar dumpadas)
            $table->unsignedBigInteger('zona_id')->nullable()->after('posicion_y');

            // Índice para mejorar consultas por zona
            $table->index('zona_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropIndex(['zona_id']);
            $table->dropColumn(['posicion_x', 'posicion_y', 'zona_id']);
        });
    }
};
