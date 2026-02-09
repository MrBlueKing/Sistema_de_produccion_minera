<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\LoteExplosivo;
use App\Models\Explosivos\MovimientoExplosivo;
use App\Models\Explosivos\StockExplosivo;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Exception;

class LoteExplosivoController extends Controller
{
    use MultiTenancy;

    /**
     * GET /api/explosivos/lotes
     * Listar lotes con filtros
     */
    public function index(Request $request)
    {
        $query = LoteExplosivo::with([
            'tipoExplosivo:id,codigo,nombre,unidad_medida',
            'polvorin:id,codigo,nombre'
        ]);

        $this->aplicarFiltroFaena($query, $request);

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->has('id_tipo_explosivo')) {
            $query->where('id_tipo_explosivo', $request->id_tipo_explosivo);
        }

        if ($request->has('id_polvorin')) {
            $query->where('id_polvorin', $request->id_polvorin);
        }

        if ($request->has('con_stock')) {
            $query->where('cantidad_actual', '>', 0);
        }

        if ($request->has('proximos_vencer')) {
            $query->proximosVencer($request->get('dias_alerta', 30));
        }

        if ($request->has('vencidos')) {
            $query->vencidos();
        }

        $lotes = $query->orderBy('fecha_ingreso', 'desc')->paginate($request->get('per_page', 20));

        // Agregar atributos calculados
        $lotes->getCollection()->transform(function ($lote) {
            $lote->porcentaje_consumido = $lote->porcentaje_consumido;
            $lote->alerta_vencimiento = $lote->alerta_vencimiento;
            $lote->dias_para_vencer = $lote->diasParaVencer();
            return $lote;
        });

        return response()->json($lotes);
    }

    /**
     * POST /api/explosivos/lotes
     * Crear un nuevo lote (registrar entrada de explosivos)
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'numero_lote' => 'required|string|max:100',
            'id_tipo_explosivo' => 'required|integer|exists:tipos_explosivos,id',
            'id_polvorin' => 'required|integer|exists:polvorines,id',
            'fecha_fabricacion' => 'nullable|date',
            'fecha_vencimiento' => 'nullable|date|after:fecha_fabricacion',
            'fecha_ingreso' => 'required|date',
            'guia_despacho' => 'nullable|string|max:100',
            'proveedor' => 'nullable|string|max:150',
            'cantidad' => 'required|numeric|min:0.01',
            'id_faena' => 'required|integer',
            'recibido_por' => 'nullable|string|max:150',
            'autorizado_por' => 'nullable|string|max:150',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        // Verificar que no exista el mismo lote
        $existente = LoteExplosivo::where('numero_lote', $request->numero_lote)
            ->where('id_tipo_explosivo', $request->id_tipo_explosivo)
            ->where('id_polvorin', $request->id_polvorin)
            ->first();

        if ($existente) {
            return response()->json([
                'error' => 'Lote duplicado',
                'mensaje' => 'Ya existe un lote con ese número para este tipo de explosivo en este polvorín',
                'lote_existente' => $existente
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Crear el lote
            $lote = LoteExplosivo::create([
                'numero_lote' => $request->numero_lote,
                'id_tipo_explosivo' => $request->id_tipo_explosivo,
                'id_polvorin' => $request->id_polvorin,
                'fecha_fabricacion' => $request->fecha_fabricacion,
                'fecha_vencimiento' => $request->fecha_vencimiento,
                'fecha_ingreso' => $request->fecha_ingreso,
                'guia_despacho' => $request->guia_despacho,
                'proveedor' => $request->proveedor,
                'cantidad_inicial' => $request->cantidad,
                'cantidad_actual' => $request->cantidad,
                'estado' => LoteExplosivo::ESTADO_ACTIVO,
                'id_faena' => $request->id_faena,
                'user_id' => auth()->id(),
                'observaciones' => $request->observaciones,
            ]);

            // Registrar el movimiento de entrada
            MovimientoExplosivo::registrarEntrada([
                'id_polvorin' => $request->id_polvorin,
                'id_tipo_explosivo' => $request->id_tipo_explosivo,
                'id_lote' => $lote->id,
                'cantidad' => $request->cantidad,
                'fecha' => $request->fecha_ingreso,
                'guia_despacho' => $request->guia_despacho,
                'recibido_por' => $request->recibido_por,
                'autorizado_por' => $request->autorizado_por,
                'motivo' => 'Ingreso de lote ' . $request->numero_lote,
                'observaciones' => $request->observaciones,
                'id_faena' => $request->id_faena,
            ]);

            DB::commit();

            $lote->load(['tipoExplosivo:id,codigo,nombre,unidad_medida', 'polvorin:id,codigo,nombre']);

            return response()->json([
                'mensaje' => 'Lote creado y entrada registrada exitosamente',
                'lote' => $lote
            ], 201);

        } catch (Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Error al crear el lote',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/explosivos/lotes/{id}
     */
    public function show($id)
    {
        $lote = LoteExplosivo::with([
            'tipoExplosivo:id,codigo,nombre,unidad_medida,dias_alerta_vencimiento',
            'polvorin:id,codigo,nombre',
            'movimientos' => function ($q) {
                $q->orderBy('fecha', 'desc')->limit(20);
            },
            'usuario:id,name'
        ])->find($id);

        if (!$lote) {
            return response()->json(['error' => 'Lote no encontrado'], 404);
        }

        $lote->porcentaje_consumido = $lote->porcentaje_consumido;
        $lote->alerta_vencimiento = $lote->alerta_vencimiento;
        $lote->dias_para_vencer = $lote->diasParaVencer();

        return response()->json($lote);
    }

    /**
     * PUT /api/explosivos/lotes/{id}
     * Solo actualiza datos informativos, no cantidades
     */
    public function update(Request $request, $id)
    {
        $lote = LoteExplosivo::find($id);

        if (!$lote) {
            return response()->json(['error' => 'Lote no encontrado'], 404);
        }

        $validator = Validator::make($request->all(), [
            'fecha_fabricacion' => 'nullable|date',
            'fecha_vencimiento' => 'nullable|date',
            'proveedor' => 'nullable|string|max:150',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote->update($request->only([
                'fecha_fabricacion', 'fecha_vencimiento', 'proveedor', 'observaciones'
            ]));

            return response()->json([
                'mensaje' => 'Lote actualizado',
                'lote' => $lote
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/explosivos/lotes/disponibles
     * Obtener lotes con stock disponible para un tipo de explosivo
     */
    public function disponibles(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_tipo_explosivo' => 'required|integer',
            'id_polvorin' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        $lotes = LoteExplosivo::where('id_tipo_explosivo', $request->id_tipo_explosivo)
            ->where('id_polvorin', $request->id_polvorin)
            ->where('estado', LoteExplosivo::ESTADO_ACTIVO)
            ->where('cantidad_actual', '>', 0)
            ->orderBy('fecha_vencimiento')  // FIFO por vencimiento
            ->orderBy('fecha_ingreso')       // FIFO por ingreso
            ->get(['id', 'numero_lote', 'cantidad_actual', 'fecha_vencimiento']);

        $lotes->each(function ($lote) {
            $lote->dias_para_vencer = $lote->diasParaVencer();
            $lote->alerta_vencimiento = $lote->alerta_vencimiento;
        });

        return response()->json($lotes);
    }

    /**
     * POST /api/explosivos/lotes/{id}/marcar-vencido
     * Marcar un lote como vencido manualmente
     */
    public function marcarVencido($id, Request $request)
    {
        $lote = LoteExplosivo::find($id);

        if (!$lote) {
            return response()->json(['error' => 'Lote no encontrado'], 404);
        }

        try {
            $lote->estado = LoteExplosivo::ESTADO_VENCIDO;
            $lote->save();

            return response()->json([
                'mensaje' => 'Lote marcado como vencido',
                'lote' => $lote
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }
}
