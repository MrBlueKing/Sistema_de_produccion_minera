<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\MovimientoExplosivo;
use App\Models\Explosivos\StockExplosivo;
use App\Models\Explosivos\LoteExplosivo;
use App\Models\Explosivos\Polvorin;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Exception;

class MovimientoExplosivoController extends Controller
{
    use MultiTenancy;

    /**
     * GET /api/explosivos/movimientos
     * Listar movimientos con filtros
     */
    public function index(Request $request)
    {
        $query = MovimientoExplosivo::with([
            'tipoExplosivo:id,codigo,nombre,unidad_medida,id_categoria',
            'tipoExplosivo.categoria:id,nombre',
            'polvorinOrigen:id,codigo,nombre',
            'polvorinDestino:id,codigo,nombre',
            'lote:id,numero_lote',
            'tronadura:id,codigo',
            'usuario:id,name',
            'reportePerforacion:id,codigo'
        ]);

        $this->aplicarFiltroFaena($query, $request);

        // Filtros
        if ($request->has('tipo')) {
            $query->where('tipo', $request->tipo);
        }

        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->fecha_desde);
        }

        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->fecha_hasta);
        }

        if ($request->has('id_tipo_explosivo')) {
            $query->where('id_tipo_explosivo', $request->id_tipo_explosivo);
        }

        if ($request->has('id_polvorin')) {
            $query->where(function ($q) use ($request) {
                $q->where('id_polvorin_origen', $request->id_polvorin)
                    ->orWhere('id_polvorin_destino', $request->id_polvorin);
            });
        }

        if ($request->has('id_tronadura')) {
            $query->where('id_tronadura', $request->id_tronadura);
        }

        if ($request->has('codigo')) {
            $query->where('codigo', 'like', '%' . $request->codigo . '%');
        }

        // Estadísticas globales con los mismos filtros (sin paginar)
        $statsQuery = MovimientoExplosivo::query();
        $this->aplicarFiltroFaena($statsQuery, $request);
        if ($request->filled('tipo'))              $statsQuery->where('tipo', $request->tipo);
        if ($request->filled('fecha_desde'))       $statsQuery->where('fecha', '>=', $request->fecha_desde);
        if ($request->filled('fecha_hasta'))       $statsQuery->where('fecha', '<=', $request->fecha_hasta);
        if ($request->filled('id_tipo_explosivo')) $statsQuery->where('id_tipo_explosivo', $request->id_tipo_explosivo);
        if ($request->filled('id_polvorin')) {
            $statsQuery->where(function ($q) use ($request) {
                $q->where('id_polvorin_origen', $request->id_polvorin)
                  ->orWhere('id_polvorin_destino', $request->id_polvorin);
            });
        }
        $resumen = $statsQuery->selectRaw("
            SUM(CASE WHEN tipo = 'entrada'    THEN 1 ELSE 0 END) as count_entradas,
            SUM(CASE WHEN tipo = 'salida'     THEN 1 ELSE 0 END) as count_salidas,
            SUM(CASE WHEN tipo = 'ajuste'     THEN 1 ELSE 0 END) as count_ajustes,
            SUM(CASE WHEN tipo = 'devolucion' THEN 1 ELSE 0 END) as count_devoluciones
        ")->first();

        $movimientos = $query->orderBy('fecha', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($request->get('per_page', 15));

        // Agregar atributos calculados. Para "transferencia" el signo depende de
        // desde qué polvorín se está mirando (el mismo movimiento es una salida
        // para el origen y una entrada para el destino) — el accessor del modelo
        // no tiene ese contexto, así que se resuelve acá contra id_polvorin.
        $idPolvorinVisto = $request->get('id_polvorin');
        $movimientos->getCollection()->transform(function ($mov) use ($idPolvorinVisto) {
            $mov->tipo_formateado = $mov->tipo_formateado;
            if ($mov->tipo === MovimientoExplosivo::TIPO_TRANSFERENCIA && $idPolvorinVisto) {
                $mov->es_positivo = (int) $mov->id_polvorin_destino === (int) $idPolvorinVisto;
            } else {
                $mov->es_positivo = $mov->es_positivo;
            }
            return $mov;
        });

        return response()->json(array_merge($movimientos->toArray(), [
            'resumen' => $resumen,
        ]));
    }

    /**
     * POST /api/explosivos/movimientos/entrada
     * Registrar entrada de explosivos
     */
    public function registrarEntrada(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_polvorin' => 'required|integer|exists:polvorines,id',
            'id_tipo_explosivo' => 'required|integer|exists:tipos_explosivos,id',
            'id_lote' => 'nullable|integer|exists:lotes_explosivos,id',
            'cantidad' => 'required|numeric|min:0.01',
            'fecha' => 'required|date',
            'hora' => 'nullable|date_format:H:i',
            'guia_despacho' => 'nullable|string|max:100',
            'recibido_por' => 'nullable|string|max:150',
            'autorizado_por' => 'nullable|string|max:150',
            'motivo' => 'nullable|string|max:255',
            'observaciones' => 'nullable|string',
            'id_faena' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $movimiento = MovimientoExplosivo::registrarEntrada($request->all());
            $movimiento->load(['tipoExplosivo:id,codigo,nombre', 'polvorinDestino:id,codigo,nombre']);

            return response()->json([
                'mensaje' => 'Entrada registrada exitosamente',
                'movimiento' => $movimiento
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al registrar la entrada',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/explosivos/movimientos/entrada-guia
     * Registrar entrada múltiple por Guía de Despacho
     */
    public function registrarEntradaGuia(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_polvorin' => 'required|integer|exists:polvorines,id',
            'fecha' => 'required|date',
            'hora' => 'nullable|date_format:H:i',
            'guia_despacho' => 'required|string|max:100',
            'comprobante_pago' => 'nullable|string|max:100',
            'proveedor' => 'nullable|string|max:200',
            'rut_proveedor' => 'nullable|string|max:20',
            'nombre_chofer' => 'nullable|string|max:150',
            'rut_chofer' => 'nullable|string|max:20',
            'patente' => 'nullable|string|max:20',
            'recibido_por' => 'nullable|string|max:150',
            'autorizado_por' => 'nullable|string|max:150',
            'observaciones' => 'nullable|string',
            'id_faena' => 'required|integer',
            'items' => 'required|array|min:1',
            'items.*.id_tipo_explosivo' => 'required|integer|exists:tipos_explosivos,id',
            'items.*.cantidad' => 'required|numeric|min:0.01',
            'items.*.numero_lote' => 'nullable|string|max:100',
            'items.*.fecha_vencimiento' => 'nullable|date',
            'items.*.precio_unitario' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $movimientos = [];
            $lotes = [];
            $observacionGuia = trim(implode(' | ', array_filter([
                $request->proveedor ? "Proveedor: {$request->proveedor}" : null,
                $request->nombre_chofer ? "Chofer: {$request->nombre_chofer}" : null,
                $request->patente ? "Patente: {$request->patente}" : null,
                $request->observaciones,
            ])));

            foreach ($request->items as $item) {
                $idLote = null;

                // Si trae número de lote, crear el lote
                if (!empty($item['numero_lote'])) {
                    $lote = LoteExplosivo::create([
                        'numero_lote' => $item['numero_lote'],
                        'id_tipo_explosivo' => $item['id_tipo_explosivo'],
                        'id_polvorin' => $request->id_polvorin,
                        'fecha_vencimiento' => $item['fecha_vencimiento'] ?? null,
                        'fecha_ingreso' => $request->fecha,
                        'guia_despacho' => $request->guia_despacho,
                        'proveedor' => $request->proveedor,
                        'cantidad_inicial' => $item['cantidad'],
                        'cantidad_actual' => $item['cantidad'],
                        'estado' => LoteExplosivo::ESTADO_ACTIVO,
                        'id_faena' => $request->id_faena,
                        'user_id' => auth()->id(),
                    ]);
                    $idLote = $lote->id;
                    $lotes[] = $lote;
                }

                $movimiento = MovimientoExplosivo::registrarEntrada([
                    'id_polvorin' => $request->id_polvorin,
                    'id_tipo_explosivo' => $item['id_tipo_explosivo'],
                    'id_lote' => $idLote,
                    'cantidad' => $item['cantidad'],
                    'fecha' => $request->fecha,
                    'hora' => $request->hora,
                    'guia_despacho' => $request->guia_despacho,
                    'comprobante_pago' => $request->comprobante_pago,
                    'recibido_por' => $request->recibido_por,
                    'autorizado_por' => $request->autorizado_por,
                    'motivo' => "Ingreso por Guía {$request->guia_despacho}",
                    'observaciones' => $observacionGuia,
                    'id_faena' => $request->id_faena,
                ]);

                $movimientos[] = $movimiento;
            }

            DB::commit();

            return response()->json([
                'mensaje' => 'Guía de despacho registrada exitosamente',
                'movimientos' => count($movimientos),
                'lotes_creados' => count($lotes),
            ], 201);

        } catch (Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Error al registrar la guía de despacho',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/explosivos/movimientos/salida
     * Registrar salida de explosivos (para tronadura)
     */
    public function registrarSalida(Request $request)
    {
        // Salida manual sin reporte: puede "hacer desaparecer" stock con solo escribir
        // un motivo, sin la trazabilidad de un reporte de perforación de por medio.
        // Restringido a Administrador de Explosivos — el polvorinero que maneja el
        // material físico día a día no debe poder también ajustar el libro contable
        // sin supervisión (separación de funciones, pedido explícito del usuario:
        // "es mucho privilegio, para que me falsifiquen datos").
        if (!$this->esUsuarioGlobal($request)) {
            return response()->json([
                'mensaje' => 'Solo el Administrador de Explosivos puede registrar salidas manuales.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'id_polvorin' => 'required|integer|exists:polvorines,id',
            'id_tipo_explosivo' => 'required|integer|exists:tipos_explosivos,id',
            'id_lote' => 'nullable|integer|exists:lotes_explosivos,id',
            'cantidad' => 'required|numeric|min:0.01',
            'id_tronadura' => 'nullable|integer|exists:tronaduras,id',
            'fecha' => 'required|date',
            'hora' => 'nullable|date_format:H:i',
            'entregado_por' => 'nullable|string|max:150',
            'autorizado_por' => 'nullable|string|max:150',
            'motivo' => 'nullable|string|max:255',
            'observaciones' => 'nullable|string',
            'id_faena' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $movimiento = MovimientoExplosivo::registrarSalida($request->all());
            $movimiento->load([
                'tipoExplosivo:id,codigo,nombre',
                'polvorinOrigen:id,codigo,nombre',
                'tronadura:id,codigo'
            ]);

            return response()->json([
                'mensaje' => 'Salida registrada exitosamente',
                'movimiento' => $movimiento
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al registrar la salida',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/explosivos/movimientos/transferencia
     * Registrar un traslado de explosivos entre polvorines (ej. Catemu -> Cabildo).
     */
    public function registrarTransferencia(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_polvorin_origen' => 'required|integer|exists:polvorines,id',
            'id_polvorin_destino' => 'required|integer|exists:polvorines,id|different:id_polvorin_origen',
            'id_tipo_explosivo' => 'required|integer|exists:tipos_explosivos,id',
            'cantidad' => 'required|numeric|min:0.01',
            'fecha' => 'required|date',
            'hora' => 'nullable|date_format:H:i',
            'guia_despacho' => 'nullable|string|max:100',
            'autorizado_por' => 'nullable|string|max:150',
            'entregado_por' => 'nullable|string|max:150',
            'recibido_por' => 'nullable|string|max:150',
            'motivo' => 'nullable|string|max:255',
            'observaciones' => 'nullable|string',
            'id_faena' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $movimiento = MovimientoExplosivo::registrarTransferencia($request->all());
            $movimiento->load([
                'tipoExplosivo:id,codigo,nombre',
                'polvorinOrigen:id,codigo,nombre',
                'polvorinDestino:id,codigo,nombre',
            ]);

            return response()->json([
                'mensaje' => 'Traslado registrado exitosamente',
                'movimiento' => $movimiento
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al registrar el traslado',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/explosivos/movimientos/salida-multiple
     * Registrar múltiples salidas para una tronadura
     */
    public function registrarSalidaMultiple(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_polvorin' => 'required|integer|exists:polvorines,id',
            'id_tronadura' => 'required|integer|exists:tronaduras,id',
            'fecha' => 'required|date',
            'hora' => 'nullable|date_format:H:i',
            'entregado_por' => 'nullable|string|max:150',
            'autorizado_por' => 'nullable|string|max:150',
            'id_faena' => 'required|integer',
            'items' => 'required|array|min:1',
            'items.*.id_tipo_explosivo' => 'required|integer|exists:tipos_explosivos,id',
            'items.*.cantidad' => 'required|numeric|min:0.01',
            'items.*.id_lote' => 'nullable|integer|exists:lotes_explosivos,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $movimientos = [];

            foreach ($request->items as $item) {
                $movimiento = MovimientoExplosivo::registrarSalida([
                    'id_polvorin' => $request->id_polvorin,
                    'id_tipo_explosivo' => $item['id_tipo_explosivo'],
                    'id_lote' => $item['id_lote'] ?? null,
                    'cantidad' => $item['cantidad'],
                    'id_tronadura' => $request->id_tronadura,
                    'fecha' => $request->fecha,
                    'hora' => $request->hora,
                    'entregado_por' => $request->entregado_por,
                    'autorizado_por' => $request->autorizado_por,
                    'motivo' => 'Consumo en tronadura',
                    'id_faena' => $request->id_faena,
                ]);

                $movimientos[] = $movimiento;
            }

            DB::commit();

            return response()->json([
                'mensaje' => 'Salidas registradas exitosamente',
                'movimientos' => count($movimientos),
            ], 201);

        } catch (Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Error al registrar las salidas',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/explosivos/movimientos/ajuste
     * Registrar ajuste de inventario
     */
    public function registrarAjuste(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_polvorin' => 'required|integer|exists:polvorines,id',
            'id_tipo_explosivo' => 'required|integer|exists:tipos_explosivos,id',
            'cantidad_nueva' => 'required|numeric|min:0',
            'fecha' => 'required|date',
            'autorizado_por' => 'required|string|max:150',
            'motivo' => 'required|string|max:255',
            'observaciones' => 'nullable|string',
            'id_faena' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $movimiento = MovimientoExplosivo::registrarAjuste($request->all());
            $movimiento->load(['tipoExplosivo:id,codigo,nombre']);

            return response()->json([
                'mensaje' => 'Ajuste registrado exitosamente',
                'movimiento' => $movimiento
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al registrar el ajuste',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/explosivos/movimientos/{id}
     */
    public function show($id)
    {
        $movimiento = MovimientoExplosivo::with([
            'tipoExplosivo:id,codigo,nombre,unidad_medida',
            'polvorinOrigen:id,codigo,nombre',
            'polvorinDestino:id,codigo,nombre',
            'lote:id,numero_lote,fecha_vencimiento',
            'tronadura:id,codigo,fecha',
            'usuario:id,name'
        ])->find($id);

        if (!$movimiento) {
            return response()->json(['error' => 'Movimiento no encontrado'], 404);
        }

        $movimiento->tipo_formateado = $movimiento->tipo_formateado;
        $movimiento->es_positivo = $movimiento->es_positivo;

        return response()->json($movimiento);
    }

    /**
     * GET /api/explosivos/movimientos/por-tronadura/{idTronadura}
     * Obtener todos los movimientos de una tronadura
     */
    public function porTronadura($idTronadura)
    {
        $movimientos = MovimientoExplosivo::with([
            'tipoExplosivo:id,codigo,nombre,unidad_medida',
            'lote:id,numero_lote'
        ])
            ->where('id_tronadura', $idTronadura)
            ->orderBy('fecha', 'desc')
            ->get();

        // Calcular totales por tipo
        $resumen = $movimientos->groupBy('id_tipo_explosivo')->map(function ($grupo) {
            $tipo = $grupo->first()->tipoExplosivo;
            return [
                'tipo_explosivo' => $tipo->codigo . ' - ' . $tipo->nombre,
                'unidad' => $tipo->unidad_medida,
                'cantidad_total' => $grupo->sum('cantidad'),
            ];
        })->values();

        return response()->json([
            'movimientos' => $movimientos,
            'resumen' => $resumen,
            'total_movimientos' => $movimientos->count(),
        ]);
    }

    /**
     * GET /api/explosivos/movimientos/reporte
     * Generar reporte de movimientos para fiscalización
     */
    public function reporte(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'fecha_desde' => 'required|date',
            'fecha_hasta' => 'required|date|after_or_equal:fecha_desde',
            'id_polvorin' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $query = MovimientoExplosivo::with([
            'tipoExplosivo:id,codigo,nombre,unidad_medida',
            'polvorinOrigen:id,codigo,nombre',
            'polvorinDestino:id,codigo,nombre',
            'tronadura:id,codigo',
        ])
            ->whereBetween('fecha', [$request->fecha_desde, $request->fecha_hasta]);

        $this->aplicarFiltroFaena($query, $request);

        if ($request->has('id_polvorin')) {
            $query->where(function ($q) use ($request) {
                $q->where('id_polvorin_origen', $request->id_polvorin)
                    ->orWhere('id_polvorin_destino', $request->id_polvorin);
            });
        }

        $movimientos = $query->orderBy('fecha')->orderBy('id')->get();

        // Calcular totales
        $entradas = $movimientos->where('tipo', MovimientoExplosivo::TIPO_ENTRADA);
        $salidas = $movimientos->where('tipo', MovimientoExplosivo::TIPO_SALIDA);

        // Agrupar por tipo de explosivo
        $resumenPorTipo = $movimientos->groupBy('id_tipo_explosivo')->map(function ($grupo) {
            $tipo = $grupo->first()->tipoExplosivo;
            $entradas = $grupo->where('tipo', MovimientoExplosivo::TIPO_ENTRADA)->sum('cantidad');
            $salidas = $grupo->where('tipo', MovimientoExplosivo::TIPO_SALIDA)->sum('cantidad');

            return [
                'codigo' => $tipo->codigo,
                'nombre' => $tipo->nombre,
                'unidad' => $tipo->unidad_medida,
                'entradas' => $entradas,
                'salidas' => $salidas,
                'diferencia' => $entradas - $salidas,
            ];
        })->values();

        return response()->json([
            'periodo' => [
                'desde' => $request->fecha_desde,
                'hasta' => $request->fecha_hasta,
            ],
            'totales' => [
                'movimientos' => $movimientos->count(),
                'entradas' => $entradas->count(),
                'salidas' => $salidas->count(),
            ],
            'resumen_por_tipo' => $resumenPorTipo,
            'movimientos' => $movimientos,
        ]);
    }

    /**
     * GET /api/explosivos/movimientos/kardex
     * Vista Kardex por tipo de explosivo, reemplazo digital del libro físico de
     * control: D/M/A | Documento (guía + comprobante de pago) | F/A (Autoridad
     * Fiscalizadora del polvorín) | Existencia Anterior | Entrada | Salida | Saldo.
     */
    public function kardex(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_tipo_explosivo' => 'required|integer|exists:tipos_explosivos,id',
            'id_polvorin' => 'required|integer|exists:polvorines,id',
            'fecha_desde' => 'required|date',
            'fecha_hasta' => 'required|date|after_or_equal:fecha_desde',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $idTipo = $request->id_tipo_explosivo;
        $idPolvorin = (int) $request->id_polvorin;

        $polvorin = Polvorin::with('autoridadFiscalizadora:id,codigo,nombre')->find($idPolvorin);
        if (!$polvorin) {
            return response()->json(['error' => 'Polvorín no encontrado'], 404);
        }

        // Neto (entrada - salida) de un conjunto de movimientos, visto desde este polvorín:
        // entradas y devoluciones suman; salidas restan; transferencias/ajustes suman o
        // restan según si este polvorín es el destino o el origen del movimiento.
        $neto = function ($movimientos) use ($idPolvorin) {
            $entrada = 0.0;
            $salida = 0.0;
            foreach ($movimientos as $m) {
                if (in_array($m->tipo, [MovimientoExplosivo::TIPO_ENTRADA, MovimientoExplosivo::TIPO_DEVOLUCION])) {
                    $entrada += (float) $m->cantidad;
                } elseif ($m->tipo === MovimientoExplosivo::TIPO_SALIDA) {
                    $salida += (float) $m->cantidad;
                } else { // transferencia o ajuste
                    if ((int) $m->id_polvorin_destino === $idPolvorin) {
                        $entrada += (float) $m->cantidad;
                    } elseif ((int) $m->id_polvorin_origen === $idPolvorin) {
                        $salida += (float) $m->cantidad;
                    }
                }
            }
            return $entrada - $salida;
        };

        $baseQuery = fn () => MovimientoExplosivo::where('id_tipo_explosivo', $idTipo)
            ->where(function ($q) use ($idPolvorin) {
                $q->where('id_polvorin_origen', $idPolvorin)
                    ->orWhere('id_polvorin_destino', $idPolvorin);
            });

        // Existencia anterior: neto de todos los movimientos previos a fecha_desde.
        $existenciaAnterior = $neto($baseQuery()->where('fecha', '<', $request->fecha_desde)->get());

        // Movimientos del período, agrupados por día calendario.
        $movimientosPeriodo = $baseQuery()
            ->whereBetween('fecha', [$request->fecha_desde, $request->fecha_hasta])
            ->orderBy('fecha')
            ->orderBy('id')
            ->get();

        $porDia = $movimientosPeriodo->groupBy(fn ($m) => $m->fecha->toDateString());

        $saldo = $existenciaAnterior;
        $filas = [];

        foreach ($porDia as $fecha => $movimientosDia) {
            $entradaDia = 0.0;      // compras
            $salidaDia = 0.0;       // consumo
            $devolucionDia = 0.0;   // volvió sin usar
            $ajusteDia = 0.0;       // correcciones (neto, con signo)
            $documentos = [];

            foreach ($movimientosDia as $m) {
                $cant = (float) $m->cantidad;
                switch ($m->tipo) {
                    case MovimientoExplosivo::TIPO_ENTRADA:
                        $entradaDia += $cant;
                        $partes = array_filter([$m->guia_despacho, $m->comprobante_pago]);
                        if (!empty($partes)) {
                            $documentos[] = implode(' / ', $partes);
                        }
                        break;
                    case MovimientoExplosivo::TIPO_SALIDA:
                        $salidaDia += $cant;
                        break;
                    case MovimientoExplosivo::TIPO_DEVOLUCION:
                        $devolucionDia += $cant;
                        break;
                    default: // ajuste / transferencia
                        if ((int) $m->id_polvorin_destino === $idPolvorin) {
                            $ajusteDia += $cant;
                        } elseif ((int) $m->id_polvorin_origen === $idPolvorin) {
                            $ajusteDia -= $cant;
                        }
                }
            }

            $saldo += $entradaDia - $salidaDia + $devolucionDia + $ajusteDia;

            $filas[] = [
                'fecha' => $fecha,
                'documento' => implode(' | ', array_unique($documentos)),
                'entrada' => round($entradaDia, 2),
                'salida' => round($salidaDia, 2),
                'devolucion' => round($devolucionDia, 2),
                'ajuste' => round($ajusteDia, 2),
                'saldo' => round($saldo, 2),
            ];
        }

        return response()->json([
            'periodo' => ['desde' => $request->fecha_desde, 'hasta' => $request->fecha_hasta],
            'polvorin' => ['id' => $polvorin->id, 'nombre' => $polvorin->nombre],
            'f_a' => $polvorin->autoridadFiscalizadora?->codigo,
            'autoridad_fiscalizadora' => $polvorin->autoridadFiscalizadora?->nombre,
            'existencia_anterior' => round($existenciaAnterior, 2),
            'filas' => $filas,
            'saldo_final' => round($saldo, 2),
        ]);
    }

    /**
     * GET /api/explosivos/movimientos/kardex-resumen
     * Resumen tipo "ingreso — salida — saldo" de TODOS los tipos de explosivo de
     * un polvorín en un rango: existencia anterior, entradas y salidas del período
     * y saldo. Para la vista "Todos" del Libro de Explosivos.
     */
    public function kardexResumen(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_polvorin' => 'required|integer|exists:polvorines,id',
            'fecha_desde' => 'required|date',
            'fecha_hasta' => 'required|date|after_or_equal:fecha_desde',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'Datos inválidos', 'detalles' => $validator->errors()], 422);
        }

        $idPolvorin = (int) $request->id_polvorin;
        $polvorin = Polvorin::with('autoridadFiscalizadora:id,codigo,nombre')->find($idPolvorin);
        if (!$polvorin) {
            return response()->json(['error' => 'Polvorín no encontrado'], 404);
        }

        // Efecto de un movimiento sobre el saldo, visto desde este polvorín:
        //  +cantidad si el material entra (entrada / devolución / ajuste-destino / transf-destino)
        //  -cantidad si sale (salida / ajuste-origen / transf-origen)
        $signo = function ($m) use ($idPolvorin) {
            if (in_array($m->tipo, [MovimientoExplosivo::TIPO_ENTRADA, MovimientoExplosivo::TIPO_DEVOLUCION], true)) {
                return 1;
            }
            if ($m->tipo === MovimientoExplosivo::TIPO_SALIDA) {
                return -1;
            }
            // transferencia / ajuste
            if ((int) $m->id_polvorin_destino === $idPolvorin) return 1;
            if ((int) $m->id_polvorin_origen === $idPolvorin) return -1;
            return 0;
        };

        // Tipos: los que tienen stock o algún movimiento en el polvorín.
        $tiposConStock = StockExplosivo::where('id_polvorin', $idPolvorin)->pluck('id_tipo_explosivo');
        $tiposConMov = MovimientoExplosivo::where(function ($q) use ($idPolvorin) {
            $q->where('id_polvorin_origen', $idPolvorin)->orWhere('id_polvorin_destino', $idPolvorin);
        })->distinct()->pluck('id_tipo_explosivo');
        $idsTipos = $tiposConStock->merge($tiposConMov)->unique()->values();

        $tipos = \App\Models\Explosivos\TipoExplosivo::whereIn('id', $idsTipos)
            ->orderBy('codigo')
            ->get(['id', 'codigo', 'nombre', 'unidad_medida']);

        $totEntradas = 0.0;
        $totSalidas = 0.0;
        $totDevoluciones = 0.0;
        $totAjustes = 0.0;

        $filas = $tipos->map(function ($tipo) use ($idPolvorin, $request, $signo, &$totEntradas, &$totSalidas, &$totDevoluciones, &$totAjustes) {
            $movs = MovimientoExplosivo::where('id_tipo_explosivo', $tipo->id)
                ->where(function ($q) use ($idPolvorin) {
                    $q->where('id_polvorin_origen', $idPolvorin)->orWhere('id_polvorin_destino', $idPolvorin);
                });

            $previos = (clone $movs)->where('fecha', '<', $request->fecha_desde)->get();
            $existenciaAnterior = 0.0;
            foreach ($previos as $m) {
                $existenciaAnterior += $signo($m) * (float) $m->cantidad;
            }

            $periodo = (clone $movs)->whereBetween('fecha', [$request->fecha_desde, $request->fecha_hasta])->get();
            $entradas = 0.0;     // solo compras
            $salidas = 0.0;      // solo consumo a tronadura
            $devoluciones = 0.0; // volvió sin usar
            $ajustes = 0.0;      // correcciones de sistema (neto, con signo)
            foreach ($periodo as $m) {
                $cant = (float) $m->cantidad;
                switch ($m->tipo) {
                    case MovimientoExplosivo::TIPO_ENTRADA:
                        $entradas += $cant;
                        break;
                    case MovimientoExplosivo::TIPO_SALIDA:
                        $salidas += $cant;
                        break;
                    case MovimientoExplosivo::TIPO_DEVOLUCION:
                        $devoluciones += $cant;
                        break;
                    default: // ajuste / transferencia
                        $ajustes += $signo($m) * $cant;
                }
            }

            $totEntradas += $entradas;
            $totSalidas += $salidas;
            $totDevoluciones += $devoluciones;
            $totAjustes += $ajustes;

            return [
                'id_tipo_explosivo' => $tipo->id,
                'codigo' => $tipo->codigo,
                'nombre' => $tipo->nombre,
                'unidad_medida' => $tipo->unidad_medida,
                'existencia_anterior' => round($existenciaAnterior, 2),
                'entradas' => round($entradas, 2),
                'salidas' => round($salidas, 2),
                'devoluciones' => round($devoluciones, 2),
                'ajustes' => round($ajustes, 2),
                'saldo' => round($existenciaAnterior + $entradas - $salidas + $devoluciones + $ajustes, 2),
            ];
        });

        return response()->json([
            'periodo' => ['desde' => $request->fecha_desde, 'hasta' => $request->fecha_hasta],
            'polvorin' => ['id' => $polvorin->id, 'nombre' => $polvorin->nombre],
            'f_a' => $polvorin->autoridadFiscalizadora?->codigo,
            'autoridad_fiscalizadora' => $polvorin->autoridadFiscalizadora?->nombre,
            'filas' => $filas,
            'total_entradas' => round($totEntradas, 2),
            'total_salidas' => round($totSalidas, 2),
            'total_devoluciones' => round($totDevoluciones, 2),
            'total_ajustes' => round($totAjustes, 2),
        ]);
    }
}
