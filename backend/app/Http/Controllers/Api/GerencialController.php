<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Lote;
use App\Models\Laboratorio\Planta;
use App\Models\Laboratorio\Empresa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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
            // ley_promedio ponderada por tonelaje (no AVG simple) — mismo criterio que
            // dumpadasDiarias()/produccionPorTurno(), para que "ley promedio" signifique
            // lo mismo en todo el dashboard gerencial.
            $statsDumpadas = (clone $queryDumpadas)
                ->select(
                    DB::raw('COUNT(*) as total'),
                    DB::raw('SUM(ton) as tonelaje_total'),
                    DB::raw('CASE WHEN SUM(ton) > 0 THEN SUM(ton * ley) / SUM(ton) ELSE NULL END as ley_promedio'),
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

            // ley_promedio ponderada por total_ton, usando ley_prom_lote (vigente desde
            // ago-2026) con fallback a ley_prom_dump (campo retirado, solo mezclas viejas
            // lo tienen) — AVG(ley_prom_dump) solo quedaba sesgado hacia mezclas antiguas.
            $statsMezclas = $queryMezclas
                ->select(
                    DB::raw('COUNT(*) as total'),
                    DB::raw('SUM(total_ton) as tonelaje_total'),
                    DB::raw('CASE WHEN SUM(CASE WHEN COALESCE(ley_prom_lote, ley_prom_dump) IS NOT NULL THEN total_ton ELSE 0 END) > 0
                        THEN SUM(total_ton * COALESCE(ley_prom_lote, ley_prom_dump, 0)) / SUM(CASE WHEN COALESCE(ley_prom_lote, ley_prom_dump) IS NOT NULL THEN total_ton ELSE 0 END)
                        ELSE NULL END as ley_promedio'),
                    DB::raw('COUNT(CASE WHEN estado = "Confirmado" THEN 1 END) as activas'),
                    DB::raw('COUNT(CASE WHEN estado = "Despachado" THEN 1 END) as completadas')
                )
                ->first();

            // Estadísticas de lotes (columnas reales: estado: Abierto/Completado).
            // total/abiertos: filtrados por fecha_creacion (fecha de negocio, cargada
            // a mano o por importación) — NO por created_at (timestamp de cuándo se
            // insertó la fila en la BD). Con datos importados en bloque, created_at
            // queda clavado en el día de la importación para cientos de filas, sin
            // relación con cuándo pasó realmente cada lote (verificado con datos
            // reales: 111 de 136 lotes tienen fecha_creacion != DATE(created_at)).
            $queryLotes = DB::table('lotes')
                ->whereBetween('fecha_creacion', [$fechaInicio, $fechaFin]);

            if ($idFaena) {
                $queryLotes->where('id_faena', $idFaena);
            }

            $statsLotes = $queryLotes
                ->select(
                    DB::raw('COUNT(*) as total'),
                    DB::raw('COUNT(CASE WHEN estado = "Abierto" THEN 1 END) as abiertos')
                )
                ->first();

            // Lotes CERRADOS en el período: usa fecha_cierre (columna agregada
            // 2026-08-10, la llena Lote::cerrar() de ahora en más) cuando existe;
            // para lotes cerrados ANTES de que existiera esa columna, cae al proxy
            // de siempre — la fecha de recepción de su ÚLTIMA camionada, que es la
            // condición real que Lote::cerrar() exige (todasCamionadasRecepcionadas()).
            // A propósito NO comparte rango con total/abiertos de arriba (esos son
            // "creados en el período", este es "cerrados en el período" — pueden
            // ser lotes distintos, un lote creado en julio puede cerrar en agosto).
            $cerradosQuery = DB::table('lotes')
                ->where('estado', 'Completado')
                ->whereRaw(
                    'COALESCE(fecha_cierre, (SELECT MAX(c.fecha_recepcion) FROM camionadas c WHERE c.lote_id = lotes.id)) BETWEEN ? AND ?',
                    [$fechaInicio, $fechaFin]
                );
            if ($idFaena) {
                $cerradosQuery->where('id_faena', $idFaena);
            }
            $lotesCerrados = $cerradosQuery->count();

            // Tonelaje total de lotes (sumando peso de camionadas asociadas a lotes
            // creados en el período — mismo criterio fecha_creacion que arriba)
            $tonelajeLotes = DB::table('camionadas')
                ->join('lotes', 'camionadas.lote_id', '=', 'lotes.id')
                ->whereBetween('lotes.fecha_creacion', [$fechaInicio, $fechaFin])
                ->when($idFaena, function ($q) use ($idFaena) {
                    return $q->where('lotes.id_faena', $idFaena);
                })
                ->sum('camionadas.peso');

            // Estadísticas de despachos/camionadas (columnas reales: peso, estado: Despachado/Recibido/Completado)
            // Filtra la faena a través del lote (fuente confiable) en vez de camionadas.id_faena
            // directo, que históricamente quedaba NULL en camionadas creadas desde la app (no desde Excel).
            $queryCamionadas = DB::table('camionadas')
                ->join('lotes', 'camionadas.lote_id', '=', 'lotes.id')
                ->whereBetween('camionadas.fecha_despacho', [$fechaInicio, $fechaFin]);

            if ($idFaena) {
                $queryCamionadas->where('lotes.id_faena', $idFaena);
            }

            $statsCamionadas = $queryCamionadas
                ->select(
                    DB::raw('COUNT(*) as total'),
                    DB::raw('SUM(camionadas.peso) as tonelaje_despachado'),
                    DB::raw('COUNT(CASE WHEN camionadas.estado = "Despachado" THEN 1 END) as despachadas'),
                    DB::raw('COUNT(CASE WHEN camionadas.estado IN ("Recibido", "Completado") THEN 1 END) as recibidas')
                )
                ->first();

            // Tonelaje RECEPCIONADO: filtra por lotes.fecha_creacion (no por
            // camionadas.fecha_recepcion) para agrupar igual que el reporte manual
            // en Excel — TODO el lote cuenta para el mes en que se creó, aunque
            // alguna de sus camionadas se haya recepcionado recién al mes siguiente.
            // Antes filtraba por fecha_recepcion de cada camionada individual, lo que
            // partía un mismo lote entre dos períodos distintos y no cuadraba con el
            // Excel (verificado con datos reales de Catemu junio 2026: un lote creado
            // en mayo con su última camionada recepcionada el 28 de junio aparecía en
            // el KPI de junio del sistema, pero el Excel lo reporta completo en mayo).
            // peso_real es el peso real confirmado al recepcionar cada camionada;
            // solo se cuentan las camionadas YA recepcionadas (whereNotNull).
            $queryRecepcion = DB::table('camionadas')
                ->join('lotes', 'camionadas.lote_id', '=', 'lotes.id')
                ->whereNotNull('camionadas.peso_real')
                ->whereBetween('lotes.fecha_creacion', [$fechaInicio, $fechaFin]);
            if ($idFaena) {
                $queryRecepcion->where('lotes.id_faena', $idFaena);
            }
            $statsRecepcion = $queryRecepcion
                ->select(
                    DB::raw('COUNT(*) as total'),
                    DB::raw('SUM(camionadas.peso_real) as tonelaje_recepcionado'),
                    DB::raw('SUM(camionadas.peso) as tonelaje_teorico')
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
                        'cerrados' => $lotesCerrados ?? 0,
                    ],
                    'despachos' => [
                        'total' => $statsCamionadas->total ?? 0,
                        'tonelaje_despachado' => round($statsCamionadas->tonelaje_despachado ?? 0, 2),
                        'despachadas' => $statsCamionadas->despachadas ?? 0,
                        'recibidas' => $statsCamionadas->recibidas ?? 0,
                    ],
                    'recepcion' => [
                        'total' => $statsRecepcion->total ?? 0,
                        'tonelaje_recepcionado' => round($statsRecepcion->tonelaje_recepcionado ?? 0, 2),
                        'tonelaje_teorico' => round($statsRecepcion->tonelaje_teorico ?? 0, 2),
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
                        ELSE NULL END as ley_ponderada'),
                    // Tonelaje pendiente: solo camionadas de lotes Abiertos que TODAVÍA no
                    // se pesaron en destino (peso_real IS NULL) — no basta con que el lote
                    // siga Abierto, porque puede tener camionadas ya recepcionadas esperando
                    // que alguien cierre el lote formalmente. Antes se usaba
                    // "peso - COALESCE(peso_real,0)" para toda camionada de un lote Abierto,
                    // pero como peso_real casi siempre es MAYOR al peso declarado al despachar
                    // (sin báscula en la mina), eso daba negativo para las ya recepcionadas y
                    // netaba contra el pendiente real de las que sí faltan — subestimándolo
                    // (verificado con datos reales: 3 grupos mostraban 8-18 t cuando el
                    // pendiente real era 29 t).
                    DB::raw('COALESCE(SUM(CASE WHEN lotes.estado = "Abierto" AND camionadas.peso_real IS NULL THEN camionadas.peso ELSE 0 END), 0) as tonelaje_pendiente'),
                    // Tonelaje vendido: peso_real de camionadas cuyo lote ya cerró (Completado)
                    // — a diferencia de "tonelaje" (despachado teórico, con lote cerrado o no),
                    // esto es lo confirmado de verdad.
                    DB::raw('COALESCE(SUM(CASE WHEN lotes.estado = "Completado" THEN camionadas.peso_real ELSE 0 END), 0) as tonelaje_vendido')
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
                    $porPlanta[$p] = ['planta' => $p, 'n_viajes' => 0, 'tonelaje' => 0, 'peso_x_ley' => 0, 'tonelaje_pendiente' => 0, 'tonelaje_vendido' => 0];
                }
                $porPlanta[$p]['n_viajes']  += $fila->n_viajes;
                $porPlanta[$p]['tonelaje']  += $fila->tonelaje;
                $porPlanta[$p]['peso_x_ley'] += $fila->tonelaje * ($fila->ley_ponderada ?? 0);
                $porPlanta[$p]['tonelaje_pendiente'] += $fila->tonelaje_pendiente;
                $porPlanta[$p]['tonelaje_vendido'] += $fila->tonelaje_vendido;
            }

            $totalesPlanta = array_values(array_map(fn($p) => [
                'planta'             => $p['planta'],
                'n_viajes'           => $p['n_viajes'],
                'tonelaje'           => round($p['tonelaje'], 2),
                'ley_ponderada'      => $p['tonelaje'] > 0 ? round($p['peso_x_ley'] / $p['tonelaje'], 3) : null,
                'tonelaje_pendiente' => round($p['tonelaje_pendiente'], 2),
                'tonelaje_vendido'   => round($p['tonelaje_vendido'], 2),
            ], $porPlanta));

            $totalTon        = array_sum(array_column($totalesPlanta, 'tonelaje'));
            $totalViajes     = array_sum(array_column($totalesPlanta, 'n_viajes'));
            $totalPesLey     = array_sum(array_map(fn($p) => $p['tonelaje'] * ($p['ley_ponderada'] ?? 0), $totalesPlanta));
            $totalPendiente  = array_sum(array_column($totalesPlanta, 'tonelaje_pendiente'));
            $totalVendido    = array_sum(array_column($totalesPlanta, 'tonelaje_vendido'));

            return response()->json([
                'success' => true,
                'data' => [
                    'filas' => $filas->map(fn($r) => [
                        'empresa'            => $r->empresa,
                        'planta'             => $r->planta,
                        'n_lotes'            => $r->n_lotes,
                        'n_viajes'           => $r->n_viajes,
                        'tonelaje'           => round($r->tonelaje, 2),
                        'ley_ponderada'      => $r->tonelaje > 0 ? round($r->ley_ponderada ?? 0, 3) : null,
                        'tonelaje_pendiente' => round($r->tonelaje_pendiente, 2),
                        'tonelaje_vendido'   => round($r->tonelaje_vendido, 2),
                    ]),
                    'totales_por_planta' => $totalesPlanta,
                    'total_general' => [
                        'n_viajes'           => $totalViajes,
                        'tonelaje'           => round($totalTon, 2),
                        'tonelaje_pendiente' => round($totalPendiente, 2),
                        'tonelaje_vendido'   => round($totalVendido, 2),
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
     * KPIs de eficiencia operacional: tonelaje (extraído/vendido) por tiro y por litro.
     * Endpoint separado de resumen() a propósito: la llamada a litros cruza al sistema
     * de Petróleo (HTTP externo) y no debe bloquear ni retrasar las 3 tarjetas KPI
     * principales que dependen de resumen().
     * GET /api/gerencial/eficiencia
     */
    public function eficiencia(Request $request)
    {
        try {
            $fechaInicio = $request->get('fecha_inicio', Carbon::now()->startOfMonth()->format('Y-m-d'));
            $fechaFin = $request->get('fecha_fin', Carbon::now()->format('Y-m-d'));
            $idFaena = $request->get('id_faena');

            // Tonelaje extraído: suma de dumpadas del período (mismo concepto que
            // dumpadas.tonelaje_total en resumen()).
            $tonelajeExtraido = DB::table('dumpadas')
                ->whereBetween('fecha', [$fechaInicio, $fechaFin])
                ->when($idFaena, fn($q) => $q->where('id_faena', $idFaena))
                ->sum('ton');

            // Tonelaje vendido: recepcionado (peso_real) Y perteneciente a un lote
            // cerrado (Completado) — no basta con "despachado", tiene que estar vendido
            // de verdad. Se filtra por fecha_recepcion (cuándo se vendió en el período),
            // no por la fecha de creación del lote.
            $tonelajeVendido = DB::table('camionadas')
                ->join('lotes', 'camionadas.lote_id', '=', 'lotes.id')
                ->where('lotes.estado', 'Completado')
                ->whereNotNull('camionadas.peso_real')
                ->whereBetween('camionadas.fecha_recepcion', [$fechaInicio, $fechaFin])
                ->when($idFaena, fn($q) => $q->where('lotes.id_faena', $idFaena))
                ->sum('camionadas.peso_real');

            // Tiros: solo reportes de Perforación y Tronadura confirmados o cerrados —
            // un reporte en Borrador no representa trabajo ejecutado ni consumo real.
            $tiros = DB::table('lineas_reporte_perforacion')
                ->join('reportes_perforacion', 'lineas_reporte_perforacion.id_reporte', '=', 'reportes_perforacion.id')
                ->whereBetween('reportes_perforacion.fecha', [$fechaInicio, $fechaFin])
                ->whereIn('reportes_perforacion.estado', ['confirmado', 'cerrado'])
                ->when($idFaena, fn($q) => $q->where('reportes_perforacion.id_faena', $idFaena))
                ->sum('lineas_reporte_perforacion.numero_tiros');

            // Litros: consumo total de combustible de la faena, desde el sistema de
            // Petróleo. Si Petróleo no responde, se devuelve litros=null y el resto del
            // payload igual — no puede tumbar este endpoint (mismo criterio que el fix de
            // PersonalAutorizadoController::disponible() para no propagar fallas externas).
            $litros = null;
            try {
                $response = Http::timeout(10)
                    ->withHeaders(['X-API-Key' => config('services.petroleo_api_key')])
                    ->get(config('services.petroleo_api') . '/consumo-litros-disponible', [
                        'id_faena' => $idFaena,
                        'fecha_desde' => $fechaInicio,
                        'fecha_hasta' => $fechaFin,
                    ]);

                if ($response->successful()) {
                    $litros = $response->json('litros_consumidos');
                } else {
                    Log::warning('Fallo la conexión con el sistema de petroleo (litros)', [
                        'status_petroleo' => $response->status(),
                    ]);
                }
            } catch (\Exception $e) {
                Log::warning('Excepción al consultar litros en el sistema de petroleo', [
                    'error' => $e->getMessage(),
                ]);
            }

            $dividir = fn($num, $den) => ($den !== null && $den > 0) ? round($num / $den, 3) : null;

            return response()->json([
                'success' => true,
                'data' => [
                    'periodo' => ['fecha_inicio' => $fechaInicio, 'fecha_fin' => $fechaFin],
                    'tonelaje_extraido' => round($tonelajeExtraido ?? 0, 2),
                    'tonelaje_vendido' => round($tonelajeVendido ?? 0, 2),
                    'tiros' => (int) $tiros,
                    'litros' => $litros !== null ? round($litros, 2) : null,
                    'ratios' => [
                        'extraido_por_tiro' => $dividir($tonelajeExtraido, $tiros),
                        'vendido_por_tiro' => $dividir($tonelajeVendido, $tiros),
                        'extraido_por_litro' => $dividir($tonelajeExtraido, $litros),
                        'vendido_por_litro' => $dividir($tonelajeVendido, $litros),
                        'litros_por_tiro' => $dividir($litros, $tiros),
                    ],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener KPIs de eficiencia',
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

    /**
     * Resumen de certificados y leyes: total de certificados emitidos en el período,
     * distribución de rangos (Alta/Media/Baja/Estéril) y serie temporal de emisión.
     * Nota: solo considera dumpadas por ahora (muestras libres certificadas son 0 hoy;
     * si en el futuro tienen volumen, sumarlas siguiendo el mismo patrón que
     * CertificadoPdfService::getCertificadosGenerados()).
     * GET /api/gerencial/certificados-resumen
     */
    public function certificadosResumen(Request $request)
    {
        try {
            $fechaInicio  = $request->get('fecha_inicio', Carbon::now()->startOfMonth()->format('Y-m-d'));
            $fechaFin     = $request->get('fecha_fin', Carbon::now()->format('Y-m-d'));
            $idFaena      = $request->get('id_faena');
            $granularidad = $request->get('granularidad', 'mes'); // dia|semana|mes|anio

            $formatoFecha = match ($granularidad) {
                'dia'    => '%Y-%m-%d',
                'semana' => '%x-%v',
                'anio'   => '%Y',
                default  => '%Y-%m',
            };

            // COALESCE porque certificados históricos (pre-fix) no tienen fecha_certificado_pdf
            $desde = $fechaInicio . ' 00:00:00';
            $hasta = $fechaFin . ' 23:59:59';

            $totalQuery = DB::table('dumpadas')
                ->whereNotNull('certificado')
                ->whereRaw('COALESCE(fecha_certificado_pdf, updated_at) BETWEEN ? AND ?', [$desde, $hasta]);
            if ($idFaena) $totalQuery->where('id_faena', $idFaena);
            $totalCertificados = (clone $totalQuery)->selectRaw('COUNT(DISTINCT certificado) as total')->value('total');

            $distribucionRango = (clone $totalQuery)
                ->select('rango')
                ->selectRaw('COUNT(*) as cantidad')
                ->groupBy('rango')
                ->get();

            $serieTemporal = (clone $totalQuery)
                ->selectRaw("DATE_FORMAT(COALESCE(fecha_certificado_pdf, updated_at), '{$formatoFecha}') as periodo")
                ->selectRaw('COUNT(DISTINCT certificado) as cantidad')
                ->groupBy('periodo')
                ->orderBy('periodo')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'periodo' => [
                        'fecha_inicio' => $fechaInicio,
                        'fecha_fin' => $fechaFin,
                        'granularidad' => $granularidad,
                    ],
                    'total_certificados' => (int) ($totalCertificados ?? 0),
                    'distribucion_rango' => $distribucionRango->map(fn($r) => [
                        'rango' => $r->rango ?? 'Sin rango',
                        'cantidad' => (int) $r->cantidad,
                    ]),
                    'serie_temporal' => $serieTemporal->map(fn($r) => [
                        'periodo' => $r->periodo,
                        'cantidad' => (int) $r->cantidad,
                    ]),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener resumen de certificados',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Dumpadas por día y frente — para gráfico de avance diario
     * GET /api/gerencial/dumpadas-diarias
     */
    public function dumpadasDiarias(Request $request)
    {
        $fechaDesde = $request->get('fecha_desde', Carbon::now()->startOfMonth()->format('Y-m-d'));
        $fechaHasta = $request->get('fecha_hasta', Carbon::now()->format('Y-m-d'));
        $idFaena    = $request->get('id_faena');

        $query = DB::table('dumpadas as d')
            ->join('frentes_trabajo as f', 'f.id', '=', 'd.id_frente_trabajo')
            ->select(
                'd.fecha',
                DB::raw('COALESCE(f.codigo_completo, CONCAT(f.manto, "-", COALESCE(f.calle, ""), COALESCE(f.hebra, ""))) as frente'),
                // Grupo = túnel (o manto cuando el frente no tiene túnel cargado, ej.
                // los "M3-"/"M5-"). Con 20-30+ frentes distintos, colorear/apilar por
                // frente individual vuelve el gráfico ilegible (más de 7 caen todos en
                // el mismo gris "Otros"); agrupando por túnel/manto quedan 5-6
                // categorías reales — el detalle por frente se mantiene en el tooltip.
                DB::raw('COALESCE(NULLIF(f.tunel, ""), f.manto) as grupo'),
                // jornada (AM/PM/Madrugada/Noche) va SIEMPRE en el resultado (no como filtro
                // aparte) para que el toggle en el frontend sea instantáneo sin recargar del
                // servidor, igual que el toggle Toneladas/Cantidad que ya existe.
                DB::raw('COALESCE(d.jornada, "Sin jornada") as jornada'),
                DB::raw('COUNT(d.id) as cantidad'),
                DB::raw('COALESCE(SUM(d.ton), 0) as toneladas'),
                DB::raw('CASE WHEN SUM(d.ton) > 0 THEN SUM(d.ton * d.ley) / SUM(d.ton) ELSE NULL END as ley_promedio')
            )
            ->whereNotNull('d.fecha')
            ->whereBetween('d.fecha', [$fechaDesde, $fechaHasta]);

        if ($idFaena) $query->where('d.id_faena', $idFaena);

        $rows = $query
            ->groupBy('d.fecha', 'frente', 'grupo', 'jornada')
            ->orderBy('d.fecha')
            ->orderBy('frente')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $rows->map(fn($r) => [
                'fecha'        => $r->fecha,
                'frente'       => $r->frente,
                'grupo'        => $r->grupo,
                'jornada'      => $r->jornada,
                'cantidad'     => (int) $r->cantidad,
                'toneladas'    => (float) $r->toneladas,
                'ley_promedio' => $r->ley_promedio !== null ? round((float) $r->ley_promedio, 3) : null,
            ]),
        ]);
    }

}
