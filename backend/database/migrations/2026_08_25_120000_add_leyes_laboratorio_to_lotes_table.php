<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ciclo de reconciliación de leyes de Laboratorio (Paquete Segunda, canje,
     * eventual Paquete Tercera) sobre el lote de planta. Todo Cu Insoluble,
     * carga 100% manual por ahora (ver session_produccion_2026_08_25).
     */
    public function up(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->decimal('ley_paquete_primera', 6, 3)->nullable()->after('observaciones');
            $table->decimal('ley_paquete_segunda', 6, 3)->nullable()->after('ley_paquete_primera');
            $table->decimal('ley_paquete_segunda_prima', 6, 3)->nullable()->after('ley_paquete_segunda');
            $table->decimal('ley_canje', 6, 3)->nullable()->after('ley_paquete_segunda_prima');
            $table->boolean('enviado_a_tercero')->default(false)->after('ley_canje');
            $table->decimal('ley_paquete_tercera', 6, 3)->nullable()->after('enviado_a_tercero');

            // Estado derivado de qué leyes están cargadas (ver Lote::actualizarEstadoLaboratorio()).
            // Independiente de la columna `estado` (Abierto/Completado), que sigue siendo de Dispatch.
            $table->enum('estado_laboratorio', [
                'Cerrado',
                'Con Paquete Segunda',
                'Listo para Canje',
                'Canjeado',
                'En Tercero',
                'Resuelto por Tercero',
            ])->default('Cerrado')->after('ley_paquete_tercera');
        });
    }

    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->dropColumn([
                'ley_paquete_primera',
                'ley_paquete_segunda',
                'ley_paquete_segunda_prima',
                'ley_canje',
                'enviado_a_tercero',
                'ley_paquete_tercera',
                'estado_laboratorio',
            ]);
        });
    }
};
