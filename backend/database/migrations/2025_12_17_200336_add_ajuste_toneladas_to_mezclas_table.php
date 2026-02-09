<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración para agregar campos de ajuste de toneladas a mezclas
 *
 * PROPÓSITO:
 * Permitir ajustar manualmente el total de toneladas de una mezcla cuando
 * el inventario físico difiere del cálculo teórico basado en pesos de dumpadas.
 *
 * CASO DE USO:
 * - Mezcla creada: 100 ton (basado en pesos teóricos de dumpadas)
 * - Despachadas: 96 ton (peso real confirmado en recepción)
 * - Remanente calculado: 4 ton
 * - Remanente físico real: 14 ton (inventario indica más material)
 * - Ajuste aplicado: +10 ton
 * - Nuevo total confirmado: 110 ton
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            // Flag que indica si se aplicó un ajuste manual
            $table->boolean('ajuste_aplicado')->default(false)->after('es_descarte');

            // Total de toneladas ORIGINAL antes del ajuste (histórico)
            $table->decimal('total_ton_original', 10, 2)->nullable()->after('ajuste_aplicado');

            // Cantidad de toneladas del ajuste (positivo o negativo)
            // Ejemplo: +10 ton, -5 ton
            $table->decimal('ajuste_toneladas', 10, 2)->nullable()->after('total_ton_original');

            // Motivo del ajuste (explicación del usuario)
            $table->text('motivo_ajuste')->nullable()->after('ajuste_toneladas');

            // Usuario que aplicó el ajuste
            $table->unsignedBigInteger('ajustado_por_user_id')->nullable()->after('motivo_ajuste');

            // Fecha y hora del ajuste
            $table->timestamp('fecha_ajuste')->nullable()->after('ajustado_por_user_id');

            // Índice para consultas
            $table->index('ajuste_aplicado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropColumn([
                'ajuste_aplicado',
                'total_ton_original',
                'ajuste_toneladas',
                'motivo_ajuste',
                'ajustado_por_user_id',
                'fecha_ajuste'
            ]);
        });
    }
};
