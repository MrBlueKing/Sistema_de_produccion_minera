<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('configuraciones_sistema')->insert([
            'clave' => 'ley_capping_maximo',
            'valor' => '3',
            'tipo' => 'number',
            'descripcion' => 'Valor máximo para el capping de ley (ley_cup). Si la ley supera este valor, ley_cup se limita a este máximo.',
            'id_faena' => null,
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
            ->where('clave', 'ley_capping_maximo')
            ->whereNull('id_faena')
            ->delete();
    }
};
