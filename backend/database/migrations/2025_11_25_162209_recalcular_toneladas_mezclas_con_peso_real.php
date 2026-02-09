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
     * Esta migración recalcula las toneladas despachadas y disponibles
     * usando SOLO el peso_real de camionadas RECEPCIONADAS
     *
     * Nueva lógica:
     * - Al crear camionada: NO se descuenta
     * - Al recepcionar camionada: SE descuenta peso_real
     * - Por tanto, solo contamos camionadas con peso_real != null
     */
    public function up(): void
    {
        // Obtener todas las mezclas
        $mezclas = DB::table('mezclas')->get();

        foreach ($mezclas as $mezcla) {
            // Solo contar camionadas RECEPCIONADAS (con peso_real)
            $pesoDespachado = DB::table('camionadas')
                ->where('mezcla_id', $mezcla->id)
                ->whereNotNull('peso_real')
                ->sum('peso_real') ?? 0;

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
