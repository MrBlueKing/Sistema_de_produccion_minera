<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Lote;
use App\Models\Laboratorio\Planta;
use App\Models\Laboratorio\Empresa;
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

            // Stock disponible: mezclas aún no despachadas completamente
            $stockQuery = DB::table('mezclas')
                ->where('toneladas_disponibles', '>', 0)
                ->whereIn('estado', ['Confirmado', 'En Despacho']);
            if ($idFaena) $stockQuery->where('id_faena', $idFaena);
            $stock = $stockQuery->select(
                DB::raw('COUNT(*) as mezclas_disponibles'),
                DB::raw('SUM(toneladas_disponibles) as toneladas_disponibles')
            )->first();

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
                    'stock' => [
                        'mezclas_disponibles' => $stock->mezclas_disponibles ?? 0,
                        'toneladas_disponibles' => round($stock->toneladas_disponibles ?? 0, 2),
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
     * Reporte de producción por empresa y planta
     */
    public function reporteProduccion(Request $request)
    {
        try {
            $fechaInicio = $request->get('fecha_inicio', Carbon::now()->startOfMonth()->format('Y-m-d'));
            $fechaFin    = $request->get('fecha_fin', Carbon::now()->format('Y-m-d'));
            $idFaena     = $request->get('id_faena');

            $filas = DB::table('lotes')
                ->leftJoin('empresas', 'lotes.empresa_id', '=', 'empresas.id')
                ->leftJoin('plantas',  'lotes.planta_id',  '=', 'plantas.id')
                ->leftJoin('camionadas', 'camionadas.lote_id', '=', 'lotes.id')
                ->whereBetween('lotes.fecha_creacion', [$fechaInicio, $fechaFin])
                ->when($idFaena, fn($q) => $q->where('lotes.id_faena', $idFaena))
                ->select(
                    DB::raw('COALESCE(empresas.nombre, "Sin empresa") as empresa'),
                    DB::raw('COALESCE(plantas.nombre,  "Sin planta")  as planta'),
                    DB::raw('COUNT(DISTINCT lotes.id) as n_lotes'),
                    DB::raw('COUNT(camionadas.id)     as n_viajes'),
                    DB::raw('COALESCE(SUM(camionadas.peso), 0) as tonelaje'),
                    DB::raw('CASE WHEN SUM(camionadas.peso) > 0
                        THEN SUM(camionadas.peso * COALESCE(camionadas.ley_mezcla, 0)) / SUM(camionadas.peso)
                        ELSE NULL END as ley_ponderada')
                )
                ->groupBy('lotes.empresa_id', 'lotes.planta_id', 'empresas.nombre', 'plantas.nombre')
                ->orderBy('plantas.nombre')
                ->orderBy('empresas.nombre')
                ->get();

            // Totales por planta
            $porPlanta = [];
            foreach ($filas as $fila) {
                $p = $fila->planta;
                if (!isset($porPlanta[$p])) {
                    $porPlanta[$p] = ['planta' => $p, 'n_viajes' => 0, 'tonelaje' => 0, 'peso_x_ley' => 0];
                }
                $porPlanta[$p]['n_viajes']  += $fila->n_viajes;
                $porPlanta[$p]['tonelaje']  += $fila->tonelaje;
                $porPlanta[$p]['peso_x_ley'] += $fila->tonelaje * ($fila->ley_ponderada ?? 0);
            }

            $totalesPlanta = array_values(array_map(fn($p) => [
                'planta'        => $p['planta'],
                'n_viajes'      => $p['n_viajes'],
                'tonelaje'      => round($p['tonelaje'], 2),
                'ley_ponderada' => $p['tonelaje'] > 0 ? round($p['peso_x_ley'] / $p['tonelaje'], 3) : null,
            ], $porPlanta));

            $totalTon    = array_sum(array_column($totalesPlanta, 'tonelaje'));
            $totalViajes = array_sum(array_column($totalesPlanta, 'n_viajes'));
            $totalPesLey = array_sum(array_map(fn($p) => $p['tonelaje'] * ($p['ley_ponderada'] ?? 0), $totalesPlanta));

            return response()->json([
                'success' => true,
                'data' => [
                    'filas' => $filas->map(fn($r) => [
                        'empresa'       => $r->empresa,
                        'planta'        => $r->planta,
                        'n_lotes'       => $r->n_lotes,
                        'n_viajes'      => $r->n_viajes,
                        'tonelaje'      => round($r->tonelaje, 2),
                        'ley_ponderada' => $r->tonelaje > 0 ? round($r->ley_ponderada ?? 0, 3) : null,
                    ]),
                    'totales_por_planta' => $totalesPlanta,
                    'total_general' => [
                        'n_viajes'      => $totalViajes,
                        'tonelaje'      => round($totalTon, 2),
                        'ley_ponderada' => $totalTon > 0 ? round($totalPesLey / $totalTon, 3) : null,
                    ],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener reporte de producción',
                'error'   => $e->getMessage(),
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

    /**
     * Búsqueda pública de lotes con filtros completos
     * GET /api/gerencial/lotes
     */
    public function buscarLotes(Request $request)
    {
        $query = Lote::with(['planta', 'empresa'])
            ->orderBy('fecha_creacion', 'desc');

        if ($request->filled('id_faena'))   $query->where('id_faena', $request->id_faena);
        if ($request->filled('planta_id'))  $query->where('planta_id', $request->planta_id);
        if ($request->filled('empresa_id')) $query->where('empresa_id', $request->empresa_id);
        if ($request->filled('estado'))     $query->where('estado', $request->estado);
        if ($request->filled('fecha_desde')) $query->whereDate('fecha_creacion', '>=', $request->fecha_desde);
        if ($request->filled('fecha_hasta')) $query->whereDate('fecha_creacion', '<=', $request->fecha_hasta);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('numero_lote', 'like', "%{$search}%")
                  ->orWhereHas('planta',  fn($q2) => $q2->where('nombre', 'like', "%{$search}%"))
                  ->orWhereHas('empresa', fn($q2) => $q2->where('nombre', 'like', "%{$search}%"));
            });
        }

        $perPage = min((int) $request->get('per_page', 30), 100);
        return response()->json($query->paginate($perPage));
    }

    /**
     * Dataset para scatter Ley Cu vs Tonelaje por lote
     * GET /api/gerencial/analisis-lotes
     */
    public function analisisLotes(Request $request)
    {
        $query = DB::table('lotes')
            ->leftJoin('empresas', 'lotes.empresa_id', '=', 'empresas.id')
            ->leftJoin('plantas',  'lotes.planta_id',  '=', 'plantas.id')
            ->leftJoin('camionadas', 'camionadas.lote_id', '=', 'lotes.id')
            ->groupBy('lotes.id', 'lotes.numero_lote', 'lotes.estado', 'lotes.id_faena', 'empresas.nombre', 'plantas.nombre')
            ->select([
                'lotes.id',
                'lotes.numero_lote',
                'lotes.estado',
                'lotes.id_faena',
                DB::raw('empresas.nombre as empresa'),
                DB::raw('plantas.nombre as planta'),
                DB::raw('ROUND(SUM(camionadas.peso), 2) as peso_total'),
                DB::raw('ROUND(
                    SUM(CASE WHEN camionadas.ley_mezcla IS NOT NULL THEN camionadas.ley_mezcla * camionadas.peso ELSE 0 END)
                    / NULLIF(SUM(CASE WHEN camionadas.ley_mezcla IS NOT NULL THEN camionadas.peso ELSE 0 END), 0)
                , 3) as ley_ponderada'),
                DB::raw('COUNT(camionadas.id) as n_camionadas'),
            ])
            ->having(DB::raw('SUM(camionadas.peso)'), '>', 0);

        if ($request->filled('id_faena'))   $query->where('lotes.id_faena', $request->id_faena);
        if ($request->filled('fecha_desde')) $query->whereDate('lotes.fecha_creacion', '>=', $request->fecha_desde);
        if ($request->filled('fecha_hasta')) $query->whereDate('lotes.fecha_creacion', '<=', $request->fecha_hasta);

        $lotes = $query->orderBy('peso_total', 'desc')->limit(300)->get();

        return response()->json(['success' => true, 'data' => $lotes]);
    }

    /** Plantas disponibles (público, para filtros de trazabilidad) */
    public function plantas()
    {
        $plantas = Planta::orderBy('nombre')->get(['id', 'nombre', 'codigo']);
        return response()->json(['data' => $plantas]);
    }

    /** Empresas disponibles (público, para filtros de trazabilidad) */
    public function empresas()
    {
        $empresas = Empresa::orderBy('nombre')->get(['id', 'nombre', 'codigo']);
        return response()->json(['data' => $empresas]);
    }

    /**
     * Árbol de reconstrucción de un lote (para trazabilidad desde sistema de petróleo)
     * GET /api/gerencial/lotes/{id}/reconstruccion
     */
    public function reconstruccionLote($id)
    {
        $lote = Lote::with([
            'planta',
            'empresa',
            'camionadas.mezclas.detalles.dumpada.frenteTrabajo',
        ])->findOrFail($id);

        $loteData = [
            'id'                => $lote->id,
            'numero_lote'       => $lote->numero_lote,
            'planta'            => $lote->planta ? ['nombre' => $lote->planta->nombre, 'codigo' => $lote->planta->codigo] : null,
            'empresa'           => $lote->empresa ? ['nombre' => $lote->empresa->nombre] : null,
            'estado'            => $lote->estado,
            'fecha_creacion'    => $lote->fecha_creacion,
            'peso_total'        => $lote->getPesoTotal(),
            'peso_recibido'     => $lote->getPesoRecibido(),
            'ley_lote_promedio' => $lote->getLeyLotePromedio(),
            'ley_lab_promedio'  => $lote->getLeyLabPromedio(),
            'numero_camionadas' => $lote->getNumeroCamionadas(),
        ];

        $camionadas = $lote->camionadas->map(function ($camionada) {
            $mezclas = $camionada->mezclas->map(function ($mezcla) {
                $componentes = $mezcla->detalles->map(function ($detalle) {
                    if ($detalle->tipo === 'DUMP' && $detalle->dumpada) {
                        $d = $detalle->dumpada;
                        $frente = $d->frenteTrabajo;
                        return [
                            'tipo'              => 'DUMP',
                            'toneladas'         => (float) $detalle->toneladas,
                            'ley_dump_ajustada' => $detalle->ley_dump_ajustada !== null ? (float) $detalle->ley_dump_ajustada : null,
                            'ley_visual_mezcla' => $detalle->ley_visual !== null ? (float) $detalle->ley_visual : null,
                            'ley_lote'          => $detalle->ley_lote !== null ? (float) $detalle->ley_lote : null,
                            'numero_dumpada'    => $d->numero_dumpada,
                            'fecha'             => $d->fecha,
                            'jornada'           => $d->jornada,
                            'frente'            => $frente ? ($frente->codigo_completo ?? $frente->manto ?? "Frente #{$d->id_frente_trabajo}") : null,
                            'tiene_lab'         => !is_null($d->ley),
                            'ley_lab'           => $d->ley !== null ? (float) $d->ley : null,
                            'ley_cup'           => $d->ley_cup !== null ? (float) $d->ley_cup : null,
                            'ley_visual'        => $d->ley_visual !== null ? (float) $d->ley_visual : null,
                            'rango'             => $d->rango,
                            'certificado'       => $d->certificado,
                        ];
                    }
                    return [
                        'tipo'              => 'REM',
                        'origen'            => $detalle->origen,
                        'toneladas'         => (float) $detalle->toneladas,
                        'ley_dump_ajustada' => $detalle->ley_dump_ajustada !== null ? (float) $detalle->ley_dump_ajustada : null,
                        'ley_lote'          => $detalle->ley_lote !== null ? (float) $detalle->ley_lote : null,
                        'ley_visual_mezcla' => $detalle->ley_visual !== null ? (float) $detalle->ley_visual : null,
                    ];
                });

                return [
                    'id'              => $mezcla->id,
                    'codigo'          => $mezcla->codigo,
                    'toneladas_pivot' => (float) $mezcla->pivot->toneladas,
                    'ley_prom_dump'   => $mezcla->ley_prom_dump !== null ? (float) $mezcla->ley_prom_dump : null,
                    'ley_prom_lote'   => $mezcla->ley_prom_lote !== null ? (float) $mezcla->ley_prom_lote : null,
                    'ley_lab'         => $mezcla->ley_lab !== null ? (float) $mezcla->ley_lab : null,
                    'es_remanente'    => (bool) $mezcla->es_remanente,
                    'componentes'     => $componentes,
                ];
            });

            return [
                'id'               => $camionada->id,
                'numero_camionada' => $camionada->numero_camionada,
                'patente'          => $camionada->patente,
                'fecha'            => $camionada->fecha_despacho,
                'peso'             => $camionada->peso !== null ? (float) $camionada->peso : null,
                'peso_real'        => $camionada->peso_real !== null ? (float) $camionada->peso_real : null,
                'estado'           => $camionada->estado,
                'ley_mezcla'       => $camionada->ley_mezcla !== null ? (float) $camionada->ley_mezcla : null,
                'ley_lab_camion'   => $camionada->ley_lab_camion !== null ? (float) $camionada->ley_lab_camion : null,
                'mezclas'          => $mezclas,
            ];
        });

        return response()->json([
            'lote'       => $loteData,
            'camionadas' => $camionadas,
        ]);
    }
}
