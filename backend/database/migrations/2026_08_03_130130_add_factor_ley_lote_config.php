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
            'clave' => 'factor_ley_lote',
            'valor' => '1.235',
            'tipo' => 'number',
            'descripcion' => 'Divisor para calcular ley_lote desde la ley cupping (o ley visual si no hay lab): ley_lote = base / factor_ley_lote. Reemplaza el esquema anterior de doble descuento (factor_ajuste_ley al cuadrado).',
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
            ->where('clave', 'factor_ley_lote')
            ->whereNull('id_faena')
            ->delete();
    }
};
