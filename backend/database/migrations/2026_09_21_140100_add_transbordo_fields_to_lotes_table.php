<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Un Lote puede abrirse SIN Planta y/o SIN Empresa todavía -- caso de
     * transbordo (ej. Santa Ana): se sabe que salió material, a veces se
     * sabe la planta pero no la empresa (o viceversa), y se completa lo que
     * falte editando el mismo lote más adelante (confirmado con el usuario
     * 2026-09-21: los 3 campos son independientes entre sí). El lote sigue
     * siendo el único contenedor -- las camionadas (Agregar Recargo) no
     * cambian en nada.
     *
     * ALTER MODIFY directo (no Schema::change(), que puede pelear con los
     * FK ya existentes de planta_id/empresa_id sin doctrine/dbal instalado).
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE lotes MODIFY planta_id BIGINT UNSIGNED NULL');
        DB::statement('ALTER TABLE lotes MODIFY empresa_id BIGINT UNSIGNED NULL');

        Schema::table('lotes', function (Blueprint $table) {
            $table->unsignedBigInteger('punto_transbordo_id')
                ->nullable()
                ->after('empresa_id')
                ->comment('Punto de transbordo (ej. Santa Ana) si el material del lote pasa por ahi antes de la planta final. Null = lote directo, sin transbordo');
            $table->index('punto_transbordo_id');
        });

        if (!DB::table('puntos_transbordo')->where('nombre', 'Parcela 15')->exists()) {
            DB::table('puntos_transbordo')->insert([
                'nombre' => 'Parcela 15',
                'id_faena' => null,
                'activo' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->dropIndex(['punto_transbordo_id']);
            $table->dropColumn('punto_transbordo_id');
        });

        DB::statement('ALTER TABLE lotes MODIFY planta_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE lotes MODIFY empresa_id BIGINT UNSIGNED NOT NULL');
    }
};
