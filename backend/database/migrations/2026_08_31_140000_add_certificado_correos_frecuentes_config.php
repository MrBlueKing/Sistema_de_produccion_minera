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
            'clave' => 'certificado_correos_frecuentes',
            'valor' => json_encode([
                'csaavedra3h@gmail.com',
                'gerencia.operacionesm3h@gmail.com',
                'm.borquez@m3h.cl',
                'mauricioruiz.m3h@gmail.com',
                's.astudillo.rivera@gmail.com',
            ]),
            'tipo' => 'json',
            'descripcion' => 'Lista de correos frecuentes para enviar certificados de Laboratorio.',
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
            ->where('clave', 'certificado_correos_frecuentes')
            ->whereNull('id_faena')
            ->delete();
    }
};
