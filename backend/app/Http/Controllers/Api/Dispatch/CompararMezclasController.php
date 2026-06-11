<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\Laboratorio\Mezcla;
use App\Models\Laboratorio\MezclaDumpada;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * [TEST] Comparar códigos de mezcla del Excel con códigos en BD.
 * Matching: conjunto de dumpadas contenidas en cada mezcla.
 */
class CompararMezclasController extends Controller
{
    /**
     * Compara códigos del Excel con mezclas existentes en BD.
     * POST /api/dispatch/importar/comparar-mezclas
     */
    public function comparar(Request $request)
    {
        $faenaId     = $request->input('faena_id');
        $mezclasInput = $request->input('mezclas', []);

        $resultados           = [];
        $sinDumpadas          = [];
        $sinMatch             = [];

        foreach ($mezclasInput as $item) {
            $codigoExcel = trim($item['codigo_excel'] ?? '');
            $dumpNums    = array_filter(array_map('strval', $item['dumpadas'] ?? []));

            if (empty($dumpNums)) {
                $sinDumpadas[] = $codigoExcel;
                continue;
            }

            // Buscar IDs de dumpadas por numero_dumpada dentro de la faena
            $dumpadasBD = Dumpada::where('id_faena', $faenaId)
                ->whereIn('numero_dumpada', $dumpNums)
                ->get(['id', 'numero_dumpada']);

            if ($dumpadasBD->isEmpty()) {
                $sinMatch[] = $codigoExcel;
                $resultados[] = [
                    'excel' => ['codigo' => $codigoExcel, 'n_dumpadas' => count($dumpNums)],
                    'db'    => null,
                    'match_tipo'    => 'sin_match',
                    'ya_coincide'   => false,
                    'n_coincidentes' => 0,
                ];
                continue;
            }

            $dumpIds = $dumpadasBD->pluck('id')->toArray();

            // Encontrar mezcla BD que contenga el mayor número de esas dumpadas
            $candidatos = MezclaDumpada::whereIn('dumpada_id', $dumpIds)
                ->where('tipo', MezclaDumpada::TIPO_DUMPADA)
                ->select('mezcla_id', DB::raw('COUNT(*) as coincidencias'))
                ->groupBy('mezcla_id')
                ->orderByDesc('coincidencias')
                ->get();

            if ($candidatos->isEmpty()) {
                $sinMatch[] = $codigoExcel;
                $resultados[] = [
                    'excel' => ['codigo' => $codigoExcel, 'n_dumpadas' => count($dumpNums)],
                    'db'    => null,
                    'match_tipo'    => 'sin_match',
                    'ya_coincide'   => false,
                    'n_coincidentes' => 0,
                ];
                continue;
            }

            $mejorCandidato  = $candidatos->first();
            $coincidencias   = (int) $mejorCandidato->coincidencias;
            $total           = count($dumpNums);

            // Match confiable si coincide más del 50% de las dumpadas
            $matchTipo = $coincidencias === $total
                ? 'exacto'
                : ($coincidencias >= max(1, ceil($total * 0.5)) ? 'parcial' : 'debil');

            $mezcla = Mezcla::find($mejorCandidato->mezcla_id);

            $resultados[] = [
                'excel' => ['codigo' => $codigoExcel, 'n_dumpadas' => $total],
                'db'    => $mezcla ? [
                    'id'        => $mezcla->id,
                    'codigo'    => $mezcla->codigo,
                    'total_ton' => $mezcla->total_ton,
                    'estado'    => $mezcla->estado,
                ] : null,
                'match_tipo'     => $matchTipo,
                'ya_coincide'    => $mezcla && $mezcla->codigo === $codigoExcel,
                'n_coincidentes' => $coincidencias,
                'n_dumpadas_bd'  => $mezcla
                    ? MezclaDumpada::where('mezcla_id', $mezcla->id)->where('tipo', MezclaDumpada::TIPO_DUMPADA)->count()
                    : 0,
            ];
        }

        usort($resultados, fn($a, $b) => strcmp($a['excel']['codigo'], $b['excel']['codigo']));

        return response()->json([
            'success'       => true,
            'resultados'    => $resultados,
            'total'         => count($resultados),
            'ya_coinciden'  => count(array_filter($resultados, fn($r) => $r['ya_coincide'])),
            'para_actualizar' => count(array_filter($resultados, fn($r) => !$r['ya_coincide'] && $r['db'] !== null)),
            'sin_match'     => count(array_filter($resultados, fn($r) => $r['db'] === null)),
        ]);
    }

    /**
     * Aplica la actualización de códigos de mezcla.
     * POST /api/dispatch/importar/actualizar-mezclas
     */
    public function actualizarCodigos(Request $request)
    {
        $actualizaciones = $request->input('actualizaciones', []);

        DB::beginTransaction();
        try {
            $actualizadas = 0;
            $errores      = [];

            foreach ($actualizaciones as $act) {
                $mezcla = Mezcla::find($act['mezcla_id']);

                if (!$mezcla) {
                    $errores[] = "Mezcla ID {$act['mezcla_id']} no encontrada";
                    continue;
                }

                $codigoViejo  = $mezcla->codigo;
                $codigoNuevo  = trim((string) $act['nuevo_codigo']);

                // Actualizar código en mezclas
                $mezcla->update(['codigo' => $codigoNuevo]);

                // Actualizar referencias en mezcla_dumpada.origen (remanentes que citan esta mezcla)
                MezclaDumpada::where('tipo', MezclaDumpada::TIPO_REMANENTE)
                    ->where('origen', 'like', '%' . $codigoViejo . '%')
                    ->get()
                    ->each(function ($det) use ($codigoViejo, $codigoNuevo) {
                        $det->update([
                            'origen' => str_replace($codigoViejo, $codigoNuevo, $det->origen),
                        ]);
                    });

                $actualizadas++;
            }

            DB::commit();

            return response()->json([
                'success'      => true,
                'actualizadas' => $actualizadas,
                'errores'      => $errores,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[CompararMezclas] Error actualizando', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }
}
