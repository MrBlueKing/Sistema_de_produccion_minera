<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Agregar configuración para activar/desactivar sistema de acopios
     */
    public function up(): void
    {
        DB::table('configuraciones_sistema')->insert([
            'clave' => 'usar_sistema_acopios',
            'valor' => 'false',
            'tipo' => 'boolean',
            'descripcion' => 'Determina si el sistema usa acopios (true) o dumpadas directas (false) para crear mezclas. Con acopios activado, las dumpadas se agrupan automáticamente por frente+jornada+fecha antes de crear mezclas.',
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
            ->where('clave', 'usar_sistema_acopios')
            ->delete();
    }
};
