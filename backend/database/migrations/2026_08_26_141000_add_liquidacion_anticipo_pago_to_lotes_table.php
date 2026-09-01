<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Continuación comercial de la reconciliación de leyes del Paquete
     * Segunda (ver 2026_08_25_*): una vez Canjeado o Resuelto por Tercero,
     * sigue el camino de plata del cuaderno del usuario: Liquidado -> Con
     * Anticipo -> Pagado (ver session_produccion_2026_08_26). El saldo
     * calculado es un snapshot al momento de cargar la liquidación real
     * (no se recalcula después si cambia la tarifa u otro dato).
     */
    public function up(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->string('liquidacion_numero', 50)->nullable()->after('ley_paquete_tercera');
            $table->decimal('liquidacion_tasa_cambio', 10, 2)->nullable()->after('liquidacion_numero');
            $table->decimal('liquidacion_saldo_real_usd', 14, 2)->nullable()->after('liquidacion_tasa_cambio');
            $table->decimal('liquidacion_saldo_real_clp', 14, 2)->nullable()->after('liquidacion_saldo_real_usd');
            $table->decimal('liquidacion_saldo_calculado_usd', 14, 2)->nullable()->after('liquidacion_saldo_real_clp');
            $table->decimal('liquidacion_saldo_calculado_clp', 14, 2)->nullable()->after('liquidacion_saldo_calculado_usd');
            $table->timestamp('fecha_liquidacion')->nullable()->after('liquidacion_saldo_calculado_clp');

            $table->decimal('anticipo_monto', 14, 2)->nullable()->after('fecha_liquidacion');
            $table->timestamp('fecha_anticipo')->nullable()->after('anticipo_monto');

            $table->decimal('pago_monto', 14, 2)->nullable()->after('fecha_anticipo');
            $table->timestamp('fecha_pago')->nullable()->after('pago_monto');

            $table->enum('estado_laboratorio', [
                'Cerrado',
                'Con Paquete Segunda',
                'Canjeado',
                'En Tercero',
                'Resuelto por Tercero',
                'Liquidado',
                'Con Anticipo',
                'Pagado',
            ])->default('Cerrado')->change();
        });
    }

    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->enum('estado_laboratorio', [
                'Cerrado',
                'Con Paquete Segunda',
                'Canjeado',
                'En Tercero',
                'Resuelto por Tercero',
            ])->default('Cerrado')->change();

            $table->dropColumn([
                'liquidacion_numero',
                'liquidacion_tasa_cambio',
                'liquidacion_saldo_real_usd',
                'liquidacion_saldo_real_clp',
                'liquidacion_saldo_calculado_usd',
                'liquidacion_saldo_calculado_clp',
                'fecha_liquidacion',
                'anticipo_monto',
                'fecha_anticipo',
                'pago_monto',
                'fecha_pago',
            ]);
        });
    }
};
