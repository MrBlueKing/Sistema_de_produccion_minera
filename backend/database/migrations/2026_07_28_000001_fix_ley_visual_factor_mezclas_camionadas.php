<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Corrige el descuento de 10% (factor 0.9) que Mezcla::calcularTotales() aplicaba
 * por error a ley_prom_visual desde diciembre 2025 (debe ser el valor crudo, es un
 * estimado a ojo, no debería llevar descuento — ver comentario actualizado en
 * Mezcla::calcularTotales()).
 *
 * 1) Mezclas: recalcula ley_prom_visual desde mezcla_dumpada (fuente de verdad,
 *    ya no tiene el bug del swap corregido en 2026_07_24_000001).
 * 2) Camionadas: propaga la corrección solo a las que calzan con el patrón
 *    conocido del bug (ratio ~0.90 contra el valor correcto ya recalculado).
 *    Las que tienen un desvío distinto (valor en 0, o de otro origen) se dejan
 *    intactas — no se explican por este bug, tocar esas sería adivinar.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1) Mezclas
        $porMezcla = DB::table('mezcla_dumpada')
            ->select('mezcla_id', DB::raw('SUM(toneladas * ley_visual) / SUM(toneladas) AS ley_visual_correcta'))
            ->groupBy('mezcla_id')
            ->havingRaw('SUM(toneladas) > 0')
            ->get()
            ->keyBy('mezcla_id');

        $mezclasCorregidas = 0;

        foreach ($porMezcla as $mezclaId => $fila) {
            $correcta = round((float) $fila->ley_visual_correcta, 2);

            $mezcla = DB::table('mezclas')->where('id', $mezclaId)->first(['ley_prom_visual']);
            if (!$mezcla || $mezcla->ley_prom_visual === null) {
                continue;
            }
            if (abs((float) $mezcla->ley_prom_visual - $correcta) <= 0.02) {
                continue; // ya está bien
            }

            DB::table('mezclas')->where('id', $mezclaId)->update(['ley_prom_visual' => $correcta]);
            $mezclasCorregidas++;
        }

        \Log::info('🔧 [FIX LEY VISUAL] Mezclas corregidas', ['cantidad' => $mezclasCorregidas]);

        // 2) Camionadas: usa el ley_prom_visual de mezclas YA corregido arriba
        $filas = DB::table('camionadas as c')
            ->join('camionada_mezcla as cm', 'cm.camionada_id', '=', 'c.id')
            ->join('mezclas as m', 'm.id', '=', 'cm.mezcla_id')
            ->whereNotNull('c.ley_visual')
            ->select('c.id', 'c.ley_visual', 'cm.toneladas', 'm.ley_prom_visual')
            ->get()
            ->groupBy('id');

        $camionadasCorregidas = 0;
        $camionadasOmitidas = 0;

        foreach ($filas as $camionadaId => $componentes) {
            $totalTon = $componentes->sum('toneladas');
            if ($totalTon <= 0) {
                continue;
            }

            $sumaPonderada = 0;
            foreach ($componentes as $componente) {
                $sumaPonderada += $componente->toneladas * (float) $componente->ley_prom_visual;
            }
            $deberiaSer = round($sumaPonderada / $totalTon, 2);
            if ($deberiaSer <= 0) {
                continue;
            }

            $guardada = (float) $componentes->first()->ley_visual;
            if (abs($guardada - $deberiaSer) <= 0.02) {
                continue; // ya está bien
            }

            $ratio = $guardada / $deberiaSer;
            $desvio = abs($ratio - 1);

            if ($desvio < 0.08 || $desvio > 0.13) {
                // No calza con el patrón conocido del bug (~10%) — no tocar
                $camionadasOmitidas++;
                continue;
            }

            DB::table('camionadas')->where('id', $camionadaId)->update(['ley_visual' => $deberiaSer]);
            $camionadasCorregidas++;
        }

        \Log::info('🔧 [FIX LEY VISUAL] Camionadas corregidas', [
            'corregidas' => $camionadasCorregidas,
            'omitidas_desvio_distinto' => $camionadasOmitidas,
        ]);
    }

    public function down(): void
    {
        // No reversible de forma segura de manera automática.
    }
};
