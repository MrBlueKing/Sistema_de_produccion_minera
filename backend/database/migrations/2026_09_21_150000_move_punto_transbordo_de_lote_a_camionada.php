<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Corrección de diseño (mismo día, sin datos reales afectados -- 0 lotes
     * tenían punto_transbordo_id seteado): el punto de transbordo es un dato
     * del VIAJE de una camionada puntual (igual que patente_camion_2), no del
     * Lote como contenedor -- un mismo Lote puede recibir recargos directos y
     * recargos vía transbordo mezclados. planta_id/empresa_id SIGUEN nullable
     * en Lote (eso sí quedó bien, no se toca).
     */
    public function up(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->dropIndex(['punto_transbordo_id']);
            $table->dropColumn('punto_transbordo_id');
        });

        Schema::table('camionadas', function (Blueprint $table) {
            $table->unsignedBigInteger('punto_transbordo_id')
                ->nullable()
                ->after('patente_camion_2')
                ->comment('Punto de transbordo (ej. Santa Ana) si esta camionada pasó por ahí. Null = viaje directo');
            $table->index('punto_transbordo_id');
        });
    }

    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            $table->dropIndex(['punto_transbordo_id']);
            $table->dropColumn('punto_transbordo_id');
        });

        Schema::table('lotes', function (Blueprint $table) {
            $table->unsignedBigInteger('punto_transbordo_id')->nullable()->after('empresa_id');
            $table->index('punto_transbordo_id');
        });
    }
};
