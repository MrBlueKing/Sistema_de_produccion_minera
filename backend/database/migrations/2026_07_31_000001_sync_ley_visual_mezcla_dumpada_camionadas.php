<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * mezcla_dumpada.ley_visual es una copia de dumpadas.ley_visual tomada al armar
 * la mezcla (MezclaDumpada::desdeDumpada()), no una relacion en vivo. El backfill
 * de Ley Visual faltante (2026_07_30_000004_fix_ley_visual_faltante_dumpadas,
 * 7.932 dumpadas) solo toco la tabla dumpadas, asi que las mezclas armadas antes
 * de ese fix quedaron con la foto vieja (mayoria en 0).
 *
 * Cascada de 3 pasos, mismo patron que 2026_07_28_000001_fix_ley_visual_factor_mezclas_camionadas:
 * 1) mezcla_dumpada.ley_visual <- dumpadas.ley_visual (solo filas tipo DUMP con dumpada_id)
 * 2) mezclas.ley_prom_visual <- promedio ponderado desde mezcla_dumpada (ya actualizado)
 * 3) camionadas.ley_visual <- promedio ponderado desde camionada_mezcla + mezclas.ley_prom_visual (ya actualizado)
 *
 * lotes/lotes_venta no necesitan tocarse: sus leyes se calculan en vivo
 * (Lote::getLeyVisualPromedio() etc.), no son una copia guardada.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1) mezcla_dumpada <- dumpadas
        $filasDesactualizadas = DB::table('mezcla_dumpada as md')
            ->join('dumpadas as d', 'd.id', '=', 'md.dumpada_id')
            ->whereRaw('ABS(COALESCE(md.ley_visual, 0) - COALESCE(d.ley_visual, 0)) > 0.01')
            ->select('md.id', 'd.ley_visual')
            ->get();

        foreach ($filasDesactualizadas as $fila) {
            DB::table('mezcla_dumpada')->where('id', $fila->id)->update(['ley_visual' => $fila->ley_visual]);
        }

        \Log::info('🔧 [SYNC LEY VISUAL] mezcla_dumpada actualizadas', ['cantidad' => $filasDesactualizadas->count()]);

        // 2) mezclas <- mezcla_dumpada (ya sincronizado arriba)
        $porMezcla = DB::table('mezcla_dumpada')
            ->select('mezcla_id', DB::raw('SUM(toneladas * ley_visual) / SUM(toneladas) AS ley_visual_correcta'))
            ->groupBy('mezcla_id')
            ->havingRaw('SUM(toneladas) > 0')
            ->get()
            ->keyBy('mezcla_id');

        $mezclasCorregidas = [];

        foreach ($porMezcla as $mezclaId => $fila) {
            $correcta = round((float) $fila->ley_visual_correcta, 2);

            $mezcla = DB::table('mezclas')->where('id', $mezclaId)->first(['ley_prom_visual']);
            if (!$mezcla || $mezcla->ley_prom_visual === null) {
                continue;
            }
            if (abs((float) $mezcla->ley_prom_visual - $correcta) <= 0.02) {
                continue;
            }

            DB::table('mezclas')->where('id', $mezclaId)->update(['ley_prom_visual' => $correcta]);
            $mezclasCorregidas[$mezclaId] = $correcta;
        }

        \Log::info('🔧 [SYNC LEY VISUAL] Mezclas corregidas', ['cantidad' => count($mezclasCorregidas)]);

        // 3) camionadas <- camionada_mezcla + mezclas (ya sincronizado arriba)
        $filas = DB::table('camionadas as c')
            ->join('camionada_mezcla as cm', 'cm.camionada_id', '=', 'c.id')
            ->join('mezclas as m', 'm.id', '=', 'cm.mezcla_id')
            ->whereNotNull('c.ley_visual')
            ->select('c.id', 'c.ley_visual', 'cm.toneladas', 'm.ley_prom_visual')
            ->get()
            ->groupBy('id');

        $camionadasCorregidas = 0;

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

            $guardada = (float) $componentes->first()->ley_visual;
            if (abs($guardada - $deberiaSer) <= 0.02) {
                continue;
            }

            DB::table('camionadas')->where('id', $camionadaId)->update(['ley_visual' => $deberiaSer]);
            $camionadasCorregidas++;
        }

        \Log::info('🔧 [SYNC LEY VISUAL] Camionadas corregidas', ['cantidad' => $camionadasCorregidas]);
    }

    public function down(): void
    {
        // No reversible de forma segura de manera automatica.
    }
};
