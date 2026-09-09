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
            // Clasificacion de material hecha en terreno (Paso 1 del plan Mineral/Esteril).
            // Default 'mineral' para que el historico (todas las dumpadas de hasta ahora,
            // que si tienen ley) no quede sin clasificar. 'esteril' es la unica que
            // habilita Ley Visual opcional y salta Envio de Muestras/Laboratorio.
            $table->enum('tipo_material', ['mineral', 'esteril'])
                ->default('mineral')
                ->after('ley_visual');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn('tipo_material');
        });
    }
};
