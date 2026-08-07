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
            'clave' => 'certificado_destinatarios_frecuentes',
            'valor' => json_encode(['Mra 3H Copper Spa']),
            'tipo' => 'json',
            'descripcion' => 'Lista de destinatarios frecuentes para el campo "Para" al generar certificados de Laboratorio.',
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
            ->where('clave', 'certificado_destinatarios_frecuentes')
            ->whereNull('id_faena')
            ->delete();
    }
};
