<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\LoteVenta;
use App\Services\Laboratorio\LoteVentaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class LoteVentaController extends Controller
{
    protected $loteVentaService;

    public function __construct(LoteVentaService $loteVentaService)
    {
        $this->loteVentaService = $loteVentaService;
    }

    /**
     * Listar todos los lotes de venta
     * GET /api/lotes-venta
     */
    public function index(Request $request)
    {
        $query = LoteVenta::with(['mezcla']);

        // Filtros opcionales
        if ($request->has('fecha_desde')) {
            $query->where('fecha_envio', '>=', $request->fecha_desde);
        }

        if ($request->has('fecha_hasta')) {
            $query->where('fecha_envio', '<=', $request->fecha_hasta);
        }

        if ($request->has('cliente')) {
            $query->where('cliente', 'like', '%' . $request->cliente . '%');
        }

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->has('con_remanente')) {
            $query->where('peso_remanente', '>', 0);
        }

        $lotes = $query->orderBy('fecha_envio', 'desc')->paginate(15);

        return response()->json($lotes);
    }

    /**
     * Crear un nuevo lote de venta
     * POST /api/lotes-venta
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'numero_lote' => 'nullable|string|max:50|unique:lotes_venta,numero_lote',
            'mezcla_id' => 'required|integer|exists:mezclas,id',
            'cliente' => 'required|string|max:150',
            'fecha_envio' => 'required|date',
            'peso_enviado' => 'required|numeric|min:0',
            'ley_lab' => 'nullable|numeric',
            'user_id' => 'nullable|integer',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = $this->loteVentaService->crearLoteVenta($request->all());

            return response()->json([
                'mensaje' => 'Lote de venta creado exitosamente',
                'lote' => $lote
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al crear el lote de venta',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener un lote de venta específico
     * GET /api/lotes-venta/{id}
     */
    public function show($id)
    {
        $lote = LoteVenta::with(['mezcla.detalles.dumpada', 'remanentesMezclas'])->find($id);

        if (!$lote) {
            return response()->json(['error' => 'Lote de venta no encontrado'], 404);
        }

        return response()->json($lote);
    }

    /**
     * Actualizar un lote de venta
     * PUT /api/lotes-venta/{id}
     */
    public function update(Request $request, $id)
    {
        $lote = LoteVenta::find($id);

        if (!$lote) {
            return response()->json(['error' => 'Lote de venta no encontrado'], 404);
        }

        $validator = Validator::make($request->all(), [
            'cliente' => 'sometimes|string|max:150',
            'fecha_envio' => 'sometimes|date',
            'peso_enviado' => 'sometimes|numeric|min:0',
            'estado' => 'sometimes|in:Preparado,Enviado,Completado',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = $this->loteVentaService->actualizarLote($id, $request->all());

            return response()->json([
                'mensaje' => 'Lote de venta actualizado exitosamente',
                'lote' => $lote
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar lote de venta',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar ley de laboratorio
     * POST /api/lotes-venta/{id}/ley-laboratorio
     */
    public function actualizarLeyLaboratorio(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'ley_lab' => 'required|numeric'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = $this->loteVentaService->actualizarLeyLaboratorio($id, $request->ley_lab);

            return response()->json([
                'mensaje' => 'Ley de laboratorio actualizada',
                'lote' => $lote
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar ley de laboratorio',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener lotes con remanente disponible
     * GET /api/lotes-venta/con-remanente
     */
    public function lotesConRemanente()
    {
        $lotes = $this->loteVentaService->obtenerLotesConRemanente();

        return response()->json($lotes);
    }

    /**
     * Agregar remanente de un lote a una mezcla
     * POST /api/lotes-venta/{id}/agregar-a-mezcla
     */
    public function agregarRemanenteAMezcla(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'mezcla_id' => 'required|integer|exists:mezclas,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $detalle = $this->loteVentaService->agregarRemanenteAMezcla($id, $request->mezcla_id);

            return response()->json([
                'mensaje' => 'Remanente agregado exitosamente a la mezcla',
                'detalle' => $detalle
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al agregar remanente',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generar reporte de lote de venta
     * GET /api/lotes-venta/{id}/reporte
     */
    public function reporte($id)
    {
        try {
            $reporte = $this->loteVentaService->generarReporte($id);

            return response()->json($reporte);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al generar reporte',
                'mensaje' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Eliminar un lote de venta
     * DELETE /api/lotes-venta/{id}
     */
    public function destroy($id)
    {
        $lote = LoteVenta::find($id);

        if (!$lote) {
            return response()->json(['error' => 'Lote de venta no encontrado'], 404);
        }

        // Verificar si el remanente ya fue usado
        if ($lote->remanentesMezclas()->exists()) {
            return response()->json([
                'error' => 'No se puede eliminar el lote',
                'mensaje' => 'El remanente de este lote ya fue utilizado en una mezcla'
            ], 422);
        }

        $lote->delete();

        return response()->json(['mensaje' => 'Lote de venta eliminado exitosamente']);
    }
}
