<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Config\MezclaConfig;

/**
 * Corrige mezclas.ley_prom_dump para mezclas donde algún detalle en mezcla_dumpada
 * tiene ley_dump_ajustada NULL o inconsistente con ley_lote (remanentes importados
 * con error de fórmula en el Excel origen, ej. #¡REF!). Antes del fix en
 * Mezcla::calcularTotales(), esos detalles se promediaban tratando el valor faltante
 * como 0, hundiendo el promedio cuando el detalle pesaba mucho del total de la mezcla.
 *
 * Recalcula ley_prom_dump con la misma fórmula ya corregida: si ley_dump_ajustada
 * falta o es inconsistente con ley_lote (relación ley_lote = ley_dump_ajustada × factor,
 * tolerancia 0.05), se deriva desde ley_lote / factor en vez de tratarlo como 0.
 *
 * No toca camionadas: su ley_mezcla se calcula desde ley_prom_lote, no desde
 * ley_prom_dump, así que no se ven afectadas por este bug.
 */
return new class extends Migration
{
    public function up(): void
    {
        $factor = (float) MezclaConfig::getFactorAjusteLey();

        $detallesPorMezcla = DB::table('mezcla_dumpada')
            ->select('mezcla_id', 'toneladas', 'ley_dump_ajustada', 'ley_lote')
            ->get()
            ->groupBy('mezcla_id');

        $corregidas = 0;

        foreach ($detallesPorMezcla as $mezclaId => $detalles) {
            $totalTon = $detalles->sum('toneladas');
            if ($totalTon <= 0) {
                continue;
            }

            $sumaDumpPonderada = $detalles->sum(function ($detalle) use ($factor) {
                $leyDump = $detalle->ley_dump_ajustada !== null ? (float) $detalle->ley_dump_ajustada : null;
                $leyLote = $detalle->ley_lote !== null ? (float) $detalle->ley_lote : null;

                $inconsistente = $leyDump !== null && $leyLote !== null
                    && abs($leyLote - ($leyDump * $factor)) > 0.05;

                if (($leyDump === null || $inconsistente) && $leyLote !== null && $factor > 0) {
                    $leyDump = $leyLote / $factor;
                }

                return (float) $detalle->toneladas * ($leyDump ?? 0);
            });

            $correcta = round($sumaDumpPonderada / $totalTon, 2);

            $mezcla = DB::table('mezclas')->where('id', $mezclaId)->first(['ley_prom_dump']);
            if (!$mezcla || $mezcla->ley_prom_dump === null) {
                continue;
            }

            if (abs((float) $mezcla->ley_prom_dump - $correcta) <= 0.02) {
                continue; // ya está bien
            }

            DB::table('mezclas')->where('id', $mezclaId)->update(['ley_prom_dump' => $correcta]);
            $corregidas++;
        }

        \Log::info('🔧 [FIX LEY PROM DUMP] Mezclas corregidas', ['cantidad' => $corregidas]);
    }

    public function down(): void
    {
        // No reversible de forma segura de manera automática.
    }
};
