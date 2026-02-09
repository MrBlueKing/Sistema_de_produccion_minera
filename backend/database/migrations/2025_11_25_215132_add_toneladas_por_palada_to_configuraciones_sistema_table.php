<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Agregar configuración de toneladas por palada
     * para calcular remanentes basados en número de paladas
     *
     * Como configuraciones_sistema es una tabla key-value,
     * insertamos el valor directamente
     */
    public function up(): void
    {
        DB::table('configuraciones_sistema')->insert([
            'clave' => 'toneladas_por_palada',
            'valor' => '1.82',
            'tipo' => 'number',
            'descripcion' => 'Toneladas por palada (para cálculo de remanentes)',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('configuraciones_sistema')
            ->where('clave', 'toneladas_por_palada')
            ->delete();
    }
};
