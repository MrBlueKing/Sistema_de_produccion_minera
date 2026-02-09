<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Esta migración actualiza las mezclas existentes para inicializar
     * los campos toneladas_disponibles y toneladas_despachadas
     *
     * IMPORTANTE: Los remanentes NO son mezclas nuevas, son toneladas disponibles
     * en mezclas existentes que pueden ser usadas en nuevas mezclas mediante
     * la tabla mezcla_dumpada con tipo='REM'
     */
    public function up(): void
    {
        // Obtener todas las mezclas
        $mezclas = DB::table('mezclas')->get();

        foreach ($mezclas as $mezcla) {
            // Obtener peso total despachado en camionadas de esta mezcla
            $pesoDespachado = DB::table('camionadas')
                ->where('mezcla_id', $mezcla->id)
                ->sum('peso') ?? 0;

            // Calcular disponibles
            $toneladasDisponibles = max(0, ($mezcla->total_ton ?? 0) - $pesoDespachado);

            // Actualizar estado basado en toneladas
            $nuevoEstado = $mezcla->estado;
            if ($toneladasDisponibles <= 0.01) {
                $nuevoEstado = 'Despachado';
            } elseif ($pesoDespachado > 0) {
                $nuevoEstado = 'En Despacho';
            }

            // Actualizar la mezcla
            DB::table('mezclas')
                ->where('id', $mezcla->id)
                ->update([
                    'toneladas_disponibles' => round($toneladasDisponibles, 2),
                    'toneladas_despachadas' => round($pesoDespachado, 2),
                    'estado' => $nuevoEstado,
                    'es_remanente' => false, // Inicializar en false
                ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No es necesario revertir, los datos quedan como están
    }
};
