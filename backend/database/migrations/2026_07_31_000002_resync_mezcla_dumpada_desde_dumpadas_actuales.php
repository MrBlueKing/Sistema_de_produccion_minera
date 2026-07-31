<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\Dispatch\Dumpada;
use App\Models\Laboratorio\Mezcla;
use App\Config\MezclaConfig;

/**
 * mezcla_dumpada.{ley_dump_ajustada,ley_visual,ley_lote} son una FOTO tomada al
 * armar la mezcla (MezclaDumpada::desdeDumpada()), no una relación en vivo con
 * dumpadas. Las auditorias de julio corrigieron datos de dumpadas (Ley Dump
 * invertida, fechas, Ley Visual faltante) DESPUES de que muchas mezclas ya
 * existian, asi que sus fotos quedaron desactualizadas — no solo en Ley Visual
 * (ver 2026_07_31_000001), sino en cualquier campo derivado de la dumpada.
 *
 * Esta migracion re-deriva los 3 campos con la MISMA formula que
 * MezclaDumpada::desdeDumpada() (fraccion segun ley_base de la mezcla, capping,
 * factor 0.9/0.81), usando los datos ACTUALES de cada dumpada, y solo actualiza
 * las filas cuyo valor derivado difiere del guardado. Despues reutiliza
 * Mezcla::calcularTotales() (la misma logica de produccion, no una reimplementacion)
 * para propagar a mezclas, y finalmente a camionadas via camionada_mezcla.
 */
return new class extends Migration
{
    public function up(): void
    {
        $factor = MezclaConfig::getFactorAjusteLey();

        $filas = DB::table('mezcla_dumpada as md')
            ->join('dumpadas as d', 'd.id', '=', 'md.dumpada_id')
            ->join('mezclas as m', 'm.id', '=', 'md.mezcla_id')
            ->whereNotNull('md.dumpada_id')
            ->select(
                'md.id',
                'md.ley_dump_ajustada as md_dump',
                'md.ley_visual as md_visual',
                'md.ley_lote as md_lote',
                'd.ley as d_ley',
                'd.ley_visual as d_visual',
                'd.cu_insoluble as d_cu_insoluble',
                'd.cu_soluble as d_cu_soluble',
                'd.id_faena as d_id_faena',
                'm.ley_base'
            )
            ->get();

        $filasActualizadas = 0;

        foreach ($filas as $fila) {
            $cuInsoluble = $fila->d_cu_insoluble !== null ? (float) $fila->d_cu_insoluble : null;
            $cuSoluble = $fila->d_cu_soluble !== null ? (float) $fila->d_cu_soluble : null;
            $tieneFraccion = $cuInsoluble !== null || $cuSoluble !== null;

            if ($tieneFraccion) {
                switch ($fila->ley_base) {
                    case 'cu_insoluble':
                        $leyEfectiva = $cuInsoluble;
                        break;
                    case 'cu_soluble':
                        $leyEfectiva = $cuSoluble;
                        break;
                    case 'cu_total':
                        $leyEfectiva = $fila->d_ley !== null ? (float) $fila->d_ley : null;
                        break;
                    case 'auto':
                    default:
                        $ins = $cuInsoluble ?? 0;
                        $sol = $cuSoluble ?? 0;
                        $leyEfectiva = $ins >= $sol
                            ? ($cuInsoluble ?? $fila->d_ley)
                            : ($cuSoluble ?? $fila->d_ley);
                        break;
                }
            } else {
                $leyEfectiva = $fila->d_ley !== null ? (float) $fila->d_ley : null;
            }

            $leyLab = $leyEfectiva;
            if ($leyLab) {
                $leyLab = Dumpada::calcularCapping($leyLab, $fila->d_id_faena);
            }
            $leyVisual = $fila->d_visual !== null ? (float) $fila->d_visual : null;

            if ($leyLab) {
                $leyDumpAjustada = round($leyLab * $factor, 2);
            } else {
                $leyDumpAjustada = $leyVisual;
            }

            if ($leyLab) {
                $leyLote = round($leyLab * $factor * $factor, 2);
            } elseif ($leyVisual) {
                $leyLote = round($leyVisual * $factor, 2);
            } else {
                $leyLote = null;
            }

            $cambia = abs((float) ($fila->md_dump ?? 0) - (float) ($leyDumpAjustada ?? 0)) > 0.01
                || abs((float) ($fila->md_visual ?? 0) - (float) ($leyVisual ?? 0)) > 0.01
                || abs((float) ($fila->md_lote ?? 0) - (float) ($leyLote ?? 0)) > 0.01;

            if (!$cambia) {
                continue;
            }

            DB::table('mezcla_dumpada')->where('id', $fila->id)->update([
                'ley_dump_ajustada' => $leyDumpAjustada,
                'ley_visual' => $leyVisual,
                'ley_lote' => $leyLote,
            ]);
            $filasActualizadas++;
        }

        \Log::info('🔧 [RESYNC MEZCLA_DUMPADA] Filas actualizadas', ['cantidad' => $filasActualizadas]);

        // Propagar a mezclas reutilizando la logica real de produccion (no reimplementada)
        $mezclasActualizadas = 0;
        Mezcla::with('detalles')->chunkById(100, function ($mezclas) use (&$mezclasActualizadas) {
            foreach ($mezclas as $mezcla) {
                $antes = [
                    'total_ton' => $mezcla->total_ton,
                    'ley_prom_dump' => $mezcla->ley_prom_dump,
                    'ley_prom_visual' => $mezcla->ley_prom_visual,
                    'ley_prom_lote' => $mezcla->ley_prom_lote,
                    'ley_lab' => $mezcla->ley_lab,
                ];

                $mezcla->calcularTotales();

                $cambio = false;
                foreach ($antes as $campo => $valorAntes) {
                    if (abs((float) ($valorAntes ?? 0) - (float) ($mezcla->{$campo} ?? 0)) > 0.02) {
                        $cambio = true;
                        break;
                    }
                }

                if ($cambio) {
                    $mezcla->save();
                    $mezclasActualizadas++;
                }
            }
        });

        \Log::info('🔧 [RESYNC MEZCLA_DUMPADA] Mezclas actualizadas', ['cantidad' => $mezclasActualizadas]);

        // Propagar a camionadas (ley_mezcla y ley_visual, ponderado por camionada_mezcla)
        $filasCamionada = DB::table('camionadas as c')
            ->join('camionada_mezcla as cm', 'cm.camionada_id', '=', 'c.id')
            ->join('mezclas as m', 'm.id', '=', 'cm.mezcla_id')
            ->select('c.id', 'c.ley_mezcla', 'c.ley_visual', 'cm.toneladas', 'm.ley_prom_lote', 'm.ley_prom_visual')
            ->get()
            ->groupBy('id');

        $camionadasActualizadas = 0;

        foreach ($filasCamionada as $camionadaId => $componentes) {
            $totalTon = $componentes->sum('toneladas');
            if ($totalTon <= 0) {
                continue;
            }

            $sumaLote = 0;
            $sumaVisual = 0;
            foreach ($componentes as $c) {
                $sumaLote += $c->toneladas * (float) ($c->ley_prom_lote ?? 0);
                $sumaVisual += $c->toneladas * (float) ($c->ley_prom_visual ?? 0);
            }
            $nuevoLeyMezcla = round($sumaLote / $totalTon, 2);
            $nuevoLeyVisual = round($sumaVisual / $totalTon, 2);

            $primero = $componentes->first();
            $cambia = ($primero->ley_mezcla !== null && abs((float) $primero->ley_mezcla - $nuevoLeyMezcla) > 0.02)
                || ($primero->ley_visual !== null && abs((float) $primero->ley_visual - $nuevoLeyVisual) > 0.02);

            if (!$cambia) {
                continue;
            }

            $update = [];
            if ($primero->ley_mezcla !== null) {
                $update['ley_mezcla'] = $nuevoLeyMezcla;
            }
            if ($primero->ley_visual !== null) {
                $update['ley_visual'] = $nuevoLeyVisual;
            }
            if (empty($update)) {
                continue;
            }

            DB::table('camionadas')->where('id', $camionadaId)->update($update);
            $camionadasActualizadas++;
        }

        \Log::info('🔧 [RESYNC MEZCLA_DUMPADA] Camionadas actualizadas', ['cantidad' => $camionadasActualizadas]);
    }

    public function down(): void
    {
        // No reversible de forma segura de manera automatica.
    }
};
