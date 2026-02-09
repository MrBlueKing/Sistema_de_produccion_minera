<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\MovimientoExplosivo;
use App\Models\Explosivos\StockExplosivo;
use App\Models\Explosivos\LoteExplosivo;
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
            'tipoExplosivo:id,codigo,nombre,unidad_medida',
            'polvorinOrigen:id,codigo,nombre',
            'polvorinDestino:id,codigo,nombre',
            'lote:id,numero_lote',
            'tronadura:id,codigo',
            'usuario:id,name'
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

        $movimientos = $query->orderBy('fecha', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($request->get('per_page', 20));

        // Agregar atributos calculados
        $movimientos->getCollection()->transform(function ($mov) {
            $mov->tipo_formateado = $mov->tipo_formateado;
            $mov->es_positivo = $mov->es_positivo;
            return $mov;
        });

        return response()->json($movimientos);
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
     * POST /api/explosivos/movimientos/salida
     * Registrar salida de explosivos (para tronadura)
     */
    public function registrarSalida(Request $request)
    {
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
}
