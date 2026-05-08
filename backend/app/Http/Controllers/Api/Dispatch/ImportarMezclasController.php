<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\Laboratorio\Mezcla;
use App\Models\Laboratorio\MezclaDumpada;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ImportarMezclasController extends Controller
{
    use MultiTenancy;

    /**
     * Preview: verifica existencia de mezclas y resuelve dumpadas en BD.
     * POST /api/dispatch/importar/mezclas/preview
     * Body: { faena_id, mezclas: [{codigo, dumpadas:[{numero_dumpada, toneladas, ley_dump, ley_visual, ley_lote}]}] }
     */
    public function preview(Request $request)
    {
        $faenaId      = $request->input('faena_id');
        $mezclasInput = $request->input('mezclas', []);

        // Recolectar todos los numeros_dumpada únicos del input
        $numerosInput = collect($mezclasInput)
            ->flatMap(fn($m) => collect($m['dumpadas'])->pluck('numero_dumpada'))
            ->unique()->values()->toArray();

        // Cache de dumpadas en BD indexado por numero_dumpada
        $dumpadasDB = Dumpada::where('id_faena', $faenaId)
            ->whereIn('numero_dumpada', $numerosInput)
            ->get(['id', 'numero_dumpada', 'fecha'])
            ->keyBy('numero_dumpada');

        // Mezclas ya existentes en BD
        $codigosInput = collect($mezclasInput)->pluck('codigo')->filter()->unique()->toArray();
        $mezclasExistentes = Mezcla::where('id_faena', $faenaId)
            ->whereIn('codigo', $codigosInput)
            ->pluck('id', 'codigo');

        $resultado = [];
        foreach ($mezclasInput as $mezcla) {
            $codigo   = $mezcla['codigo'];
            $dumpadas = $mezcla['dumpadas'] ?? [];

            $encontradas = [];
            $faltantes   = [];
            $fechas      = [];
            $totalTon    = 0;
            $sumLote     = 0;

            foreach ($dumpadas as $d) {
                $num = (string)($d['numero_dumpada'] ?? '');
                $ton = (float)($d['toneladas'] ?? 0);

                if ($dumpadasDB->has($num)) {
                    $dump = $dumpadasDB->get($num);
                    $encontradas[] = $num;
                    if ($dump->fecha) $fechas[] = (string)$dump->fecha;
                    $totalTon += $ton;
                    $sumLote  += (float)($d['ley_lote'] ?? 0) * $ton;
                } else {
                    $faltantes[] = $num;
                }
            }

            // Remanentes: su ley_lote sí se incluye en el promedio ponderado
            $remanentes    = $mezcla['remanentes'] ?? [];
            $remanentesTon = 0;
            foreach ($remanentes as $rem) {
                $ton            = (float)($rem['toneladas'] ?? 0);
                $remanentesTon += $ton;
                $totalTon      += $ton;
                $sumLote       += (float)($rem['ley_lote'] ?? 0) * $ton;
            }

            $factor      = \App\Config\MezclaConfig::getFactorAjusteLey();
            $fechaCalc   = !empty($fechas) ? max($fechas) : null;
            $leyPromLote = $totalTon > 0 ? round($sumLote / $totalTon, 3)    : null;
            $leyPromDump = $leyPromLote   ? round($leyPromLote / $factor, 3) : null;

            $resultado[] = [
                'codigo'               => $codigo,
                'existe'               => $mezclasExistentes->has($codigo),
                'fecha_calculada'      => $fechaCalc,
                'total_ton'            => round($totalTon, 2),
                'ley_prom_dump'        => $leyPromDump,
                'ley_prom_lote'        => $leyPromLote,
                'dumpadas_total'       => count($dumpadas),
                'dumpadas_encontradas' => count($encontradas),
                'dumpadas_faltantes'   => $faltantes,
                'remanentes_count'     => count($remanentes),
                'remanentes_ton'       => round($remanentesTon, 2),
            ];
        }

        return response()->json(['success' => true, 'mezclas' => $resultado]);
    }

    /**
     * Confirmar importación masiva de mezclas.
     * POST /api/dispatch/importar/mezclas/confirmar
     * Body: { faena_id, planta_id, mezclas: [...] }
     */
    public function confirmar(Request $request)
    {
        $faenaId      = $request->input('faena_id');
        $plantaId     = $request->input('planta_id');
        $mezclasInput = $request->input('mezclas', []);

        $creadas  = 0;
        $saltadas = 0;
        $errores  = [];

        // Cache dumpadas completo (para crear los detalles)
        $numerosInput = collect($mezclasInput)
            ->flatMap(fn($m) => collect($m['dumpadas'])->pluck('numero_dumpada'))
            ->unique()->values()->toArray();

        $dumpadasDB = Dumpada::where('id_faena', $faenaId)
            ->whereIn('numero_dumpada', $numerosInput)
            ->get()
            ->keyBy('numero_dumpada');

        // Mezclas ya existentes
        $codigosInput = collect($mezclasInput)->pluck('codigo')->filter()->unique()->toArray();
        $mezclasExistentes = Mezcla::where('id_faena', $faenaId)
            ->whereIn('codigo', $codigosInput)
            ->pluck('id', 'codigo');

        foreach ($mezclasInput as $i => $mezclaData) {
            try {
                $codigo = $mezclaData['codigo'];

                if ($mezclasExistentes->has($codigo)) {
                    $saltadas++;
                    continue;
                }

                $dumpadas  = $mezclaData['dumpadas'] ?? [];
                $fechas    = [];
                $totalTon  = 0;
                $sumVisual = 0;
                $sumLote   = 0;
                $detalles  = [];

                foreach ($dumpadas as $d) {
                    $num = (string)($d['numero_dumpada'] ?? '');
                    if (!$dumpadasDB->has($num)) continue;

                    $dump    = $dumpadasDB->get($num);
                    $ton     = (float)($d['toneladas']  ?? 0);
                    $leyDump = isset($d['ley_dump'])   ? (float)$d['ley_dump']   : null;
                    $leyVis  = isset($d['ley_visual']) ? (float)$d['ley_visual'] : null;
                    $leyLote = isset($d['ley_lote'])   ? (float)$d['ley_lote']   : null;

                    if ($dump->fecha) $fechas[] = (string)$dump->fecha;
                    $totalTon  += $ton;
                    if ($leyVis)  $sumVisual += $leyVis  * $ton;
                    if ($leyLote) $sumLote   += $leyLote * $ton;

                    $detalles[] = [
                        'dump'    => $dump,
                        'ton'     => $ton,
                        'leyDump' => $leyDump,
                        'leyVis'  => $leyVis,
                        'leyLote' => $leyLote,
                        'acopios' => $d['acopios'] ?? $dump->acopios ?? '',
                    ];
                }

                // Remanentes: su ley_lote sí se incluye en el promedio ponderado
                $remDetalles     = [];
                $factor          = \App\Config\MezclaConfig::getFactorAjusteLey();
                $remanentesInput = $mezclaData['remanentes'] ?? [];
                foreach ($remanentesInput as $rem) {
                    $ton = (float)($rem['toneladas'] ?? 0);
                    if ($ton <= 0) continue;
                    $leyVis  = isset($rem['ley_visual']) ? (float)$rem['ley_visual'] : null;
                    $leyLote = isset($rem['ley_lote'])   ? (float)$rem['ley_lote']   : null;
                    // Solo usar ley_dump si viene del Excel; #¡REF! → null
                    $leyDump = isset($rem['ley_dump']) && $rem['ley_dump'] !== null ? (float)$rem['ley_dump'] : null;
                    $totalTon  += $ton;
                    if ($leyVis)  $sumVisual += $leyVis  * $ton;
                    if ($leyLote) $sumLote   += $leyLote * $ton;
                    $remDetalles[] = [
                        'origen'        => $rem['origen'] ?? 'Remanente importado',
                        'ton'           => $ton,
                        'leyDump'       => $leyDump,
                        'leyVis'        => $leyVis,
                        'leyLote'       => $leyLote,
                        'numeroPaladas' => isset($rem['numero_paladas']) ? (int)$rem['numero_paladas'] : null,
                    ];
                }

                if (empty($detalles) && empty($remDetalles)) {
                    $saltadas++;
                    continue;
                }
                $fecha       = !empty($fechas) ? max($fechas) : now()->format('Y-m-d');
                $leyPromLote = $totalTon > 0 ? round($sumLote   / $totalTon, 3)    : null;
                $leyPromVis  = $totalTon > 0 ? round($sumVisual / $totalTon, 3)    : null;
                $leyPromDump = $leyPromLote   ? round($leyPromLote / $factor, 3)   : null;
                $leyLab      = $leyPromDump   ? round($leyPromDump / $factor, 3)   : null;

                $mezcla = Mezcla::create([
                    'codigo'                => $codigo,
                    'fecha'                 => $fecha,
                    'id_faena'              => $faenaId,
                    'planta_id'             => $plantaId,
                    'total_ton'             => round($totalTon, 2),
                    'toneladas_disponibles' => round($totalTon, 2),
                    'toneladas_despachadas' => 0,
                    'ley_prom_dump'         => $leyPromDump,
                    'ley_prom_visual'       => $leyPromVis,
                    'ley_prom_lote'         => $leyPromLote,
                    'ley_lab'               => $leyLab,
                    'estado'                => Mezcla::ESTADO_CONFIRMADO,
                    'es_remanente'          => false,
                    'es_descarte'           => false,
                    'user_id'               => $request->auth_user_id,
                ]);

                foreach ($detalles as $det) {
                    MezclaDumpada::create([
                        'mezcla_id'         => $mezcla->id,
                        'dumpada_id'        => $det['dump']->id,
                        'tipo'              => MezclaDumpada::TIPO_DUMPADA,
                        'origen'            => $det['acopios'] ?: "Dumpada #{$det['dump']->numero_dumpada}",
                        'toneladas'         => $det['ton'],
                        'ley_dump_ajustada' => $det['leyDump'],
                        'ley_visual'        => $det['leyVis'],
                        'ley_lote'          => $det['leyLote'],
                    ]);
                }

                foreach ($remDetalles as $rem) {
                    MezclaDumpada::create([
                        'mezcla_id'         => $mezcla->id,
                        'dumpada_id'        => null,
                        'tipo'              => MezclaDumpada::TIPO_REMANENTE,
                        'origen'            => $rem['origen'],
                        'toneladas'         => $rem['ton'],
                        'numero_paladas'    => $rem['numeroPaladas'],
                        'ley_dump_ajustada' => $rem['leyDump'],
                        'ley_visual'        => $rem['leyVis'],
                        'ley_lote'          => $rem['leyLote'],
                    ]);
                }

                $creadas++;

            } catch (\Exception $e) {
                $errores[] = [
                    'index'  => $i,
                    'codigo' => $mezclaData['codigo'] ?? '?',
                    'error'  => $e->getMessage(),
                ];
                Log::error('Error importando mezcla', [
                    'index'  => $i,
                    'codigo' => $mezclaData['codigo'] ?? '?',
                    'error'  => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            'success'  => true,
            'creadas'  => $creadas,
            'saltadas' => $saltadas,
            'errores'  => $errores,
        ]);
    }
}
