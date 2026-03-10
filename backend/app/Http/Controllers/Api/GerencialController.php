<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class GerencialController extends Controller
{
    /**
     * Resumen gerencial completo
     */
    public function resumen(Request $request)
    {
        try {
            $fechaInicio = $request->get('fecha_inicio', Carbon::now()->startOfMonth()->format('Y-m-d'));
            $fechaFin = $request->get('fecha_fin', Carbon::now()->format('Y-m-d'));
            $idFaena = $request->get('id_faena');

            // Query base para dumpadas
            $queryDumpadas = DB::table('dumpadas')
                ->whereBetween('fecha', [$fechaInicio, $fechaFin]);

            if ($idFaena) {
                $queryDumpadas->where('id_faena', $idFaena);
            }

            // Estadísticas de dumpadas (columnas reales: ton, ley, estado: Ingresado/Completado/etc)
            $statsDumpadas = (clone $queryDumpadas)
                ->select(
                    DB::raw('COUNT(*) as total'),
                    DB::raw('SUM(ton) as tonelaje_total'),
                    DB::raw('AVG(ley) as ley_promedio'),
                    DB::raw('COUNT(CASE WHEN estado = "Completado" THEN 1 END) as completadas'),
                    DB::raw('COUNT(CASE WHEN estado = "Ingresado" THEN 1 END) as pendientes')
                )
                ->first();

            // Estadísticas de mezclas (columnas reales: total_ton, ley_prom_dump, estado: Confirmado/En Despacho/Despachado)
            $queryMezclas = DB::table('mezclas')
                ->whereBetween('created_at', [$fechaInicio . ' 00:00:00', $fechaFin . ' 23:59:59']);

            if ($idFaena) {
                $queryMezclas->where('id_faena', $idFaena);
            }

            $statsMezclas = $queryMezclas
                ->select(
                    DB::raw('COUNT(*) as total'),
                    DB::raw('SUM(total_ton) as tonelaje_total'),
                    DB::raw('AVG(ley_prom_dump) as ley_promedio'),
                    DB::raw('COUNT(CASE WHEN estado = "Confirmado" THEN 1 END) as activas'),
                    DB::raw('COUNT(CASE WHEN estado = "Despachado" THEN 1 END) as completadas')
                )
                ->first();

            // Estadísticas de lotes (columnas reales: estado: Abierto/Completado)
            $queryLotes = DB::table('lotes')
                ->whereBetween('created_at', [$fechaInicio . ' 00:00:00', $fechaFin . ' 23:59:59']);

            if ($idFaena) {
                $queryLotes->where('id_faena', $idFaena);
            }

            $statsLotes = $queryLotes
                ->select(
                    DB::raw('COUNT(*) as total'),
                    DB::raw('COUNT(CASE WHEN estado = "Abierto" THEN 1 END) as abiertos'),
                    DB::raw('COUNT(CASE WHEN estado = "Completado" THEN 1 END) as cerrados')
                )
                ->first();

            // Tonelaje total de lotes (sumando peso de camionadas asociadas)
            $tonelajeLotes = DB::table('camionadas')
                ->join('lotes', 'camionadas.lote_id', '=', 'lotes.id')
                ->whereBetween('lotes.created_at', [$fechaInicio . ' 00:00:00', $fechaFin . ' 23:59:59'])
                ->when($idFaena, function ($q) use ($idFaena) {
                    return $q->where('lotes.id_faena', $idFaena);
                })
                ->sum('camionadas.peso');

            // Estadísticas de despachos/camionadas (columnas reales: peso, estado: Despachado/Recibido/Completado)
            $queryCamionadas = DB::table('camionadas')
                ->whereBetween('fecha_despacho', [$fechaInicio, $fechaFin]);

            if ($idFaena) {
                $queryCamionadas->where('id_faena', $idFaena);
            }

            $statsCamionadas = $queryCamionadas
                ->select(
                    DB::raw('COUNT(*) as total'),
                    DB::raw('SUM(peso) as tonelaje_despachado'),
                    DB::raw('COUNT(CASE WHEN estado = "Despachado" THEN 1 END) as despachadas'),
                    DB::raw('COUNT(CASE WHEN estado IN ("Recibido", "Completado") THEN 1 END) as recibidas')
                )
                ->first();

            // Producción por día (últimos 7 días)
            $produccionDiaria = DB::table('dumpadas')
                ->select(
                    'fecha',
                    DB::raw('COUNT(*) as cantidad'),
                    DB::raw('SUM(ton) as tonelaje'),
                    DB::raw('AVG(ley) as ley_promedio')
                )
                ->where('fecha', '>=', Carbon::now()->subDays(7)->format('Y-m-d'))
                ->when($idFaena, function ($q) use ($idFaena) {
                    return $q->where('id_faena', $idFaena);
                })
                ->groupBy('fecha')
                ->orderBy('fecha', 'desc')
                ->get();

            // Top frentes de trabajo
            $topFrentes = DB::table('dumpadas')
                ->join('frentes_trabajo', 'dumpadas.id_frente_trabajo', '=', 'frentes_trabajo.id')
                ->select(
                    'frentes_trabajo.codigo_completo as nombre',
                    DB::raw('COUNT(*) as cantidad'),
                    DB::raw('SUM(dumpadas.ton) as tonelaje'),
                    DB::raw('AVG(dumpadas.ley) as ley_promedio')
                )
                ->whereBetween('dumpadas.fecha', [$fechaInicio, $fechaFin])
                ->when($idFaena, function ($q) use ($idFaena) {
                    return $q->where('dumpadas.id_faena', $idFaena);
                })
                ->groupBy('frentes_trabajo.id', 'frentes_trabajo.codigo_completo')
                ->orderBy('tonelaje', 'desc')
                ->limit(10)
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'periodo' => [
                        'fecha_inicio' => $fechaInicio,
                        'fecha_fin' => $fechaFin,
                    ],
                    'dumpadas' => [
                        'total' => $statsDumpadas->total ?? 0,
                        'tonelaje_total' => round($statsDumpadas->tonelaje_total ?? 0, 2),
                        'ley_promedio' => round($statsDumpadas->ley_promedio ?? 0, 2),
                        'completadas' => $statsDumpadas->completadas ?? 0,
                        'pendientes' => $statsDumpadas->pendientes ?? 0,
                    ],
                    'mezclas' => [
                        'total' => $statsMezclas->total ?? 0,
                        'tonelaje_total' => round($statsMezclas->tonelaje_total ?? 0, 2),
                        'ley_promedio' => round($statsMezclas->ley_promedio ?? 0, 2),
                        'activas' => $statsMezclas->activas ?? 0,
                        'completadas' => $statsMezclas->completadas ?? 0,
                    ],
                    'lotes' => [
                        'total' => $statsLotes->total ?? 0,
                        'tonelaje_total' => round($tonelajeLotes ?? 0, 2),
                        'abiertos' => $statsLotes->abiertos ?? 0,
                        'cerrados' => $statsLotes->cerrados ?? 0,
                    ],
                    'despachos' => [
                        'total' => $statsCamionadas->total ?? 0,
                        'tonelaje_despachado' => round($statsCamionadas->tonelaje_despachado ?? 0, 2),
                        'despachadas' => $statsCamionadas->despachadas ?? 0,
                        'recibidas' => $statsCamionadas->recibidas ?? 0,
                    ],
                    'produccion_diaria' => $produccionDiaria,
                    'top_frentes' => $topFrentes,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener resumen gerencial',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener faenas disponibles
     */
    public function faenas()
    {
        try {
            $faenas = DB::table('dumpadas')
                ->select('id_faena')
                ->distinct()
                ->whereNotNull('id_faena')
                ->pluck('id_faena');

            return response()->json([
                'success' => true,
                'data' => $faenas,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener faenas',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
