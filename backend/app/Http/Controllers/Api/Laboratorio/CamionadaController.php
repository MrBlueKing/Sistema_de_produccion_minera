<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Services\Laboratorio\CamionadaService;
use App\Models\Laboratorio\Camionada;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CamionadaController extends Controller
{
    protected $camionadaService;

    public function __construct(CamionadaService $camionadaService)
    {
        $this->camionadaService = $camionadaService;
    }

    /**
     * Listar todas las camionadas con filtros
     * GET /api/dispatch/camionadas
     */
    public function index(Request $request)
    {
        $query = Camionada::with(['mezcla', 'lote.planta', 'lote.empresa']);

        // Filtros
        if ($request->has('mezcla_id')) {
            $query->where('mezcla_id', $request->mezcla_id);
        }

        if ($request->has('cliente')) {
            $query->where('cliente', 'like', '%' . $request->cliente . '%');
        }

        if ($request->has('planta')) {
            $query->where('planta', $request->planta);
        }

        if ($request->has('patente')) {
            $query->where('patente', 'like', '%' . $request->patente . '%');
        }

        if ($request->has('fecha_desde')) {
            $query->where('fecha_despacho', '>=', $request->fecha_desde);
        }

        if ($request->has('fecha_hasta')) {
            $query->where('fecha_despacho', '<=', $request->fecha_hasta);
        }

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }

        $camionadas = $query->orderBy('fecha_despacho', 'desc')
            ->orderBy('id', 'desc')
            ->get();

        return response()->json($camionadas);
    }

    /**
     * Obtener una camionada específica
     * GET /api/dispatch/camionadas/{id}
     */
    public function show($id)
    {
        $camionada = Camionada::with(['mezcla.detalles'])->findOrFail($id);
        return response()->json($camionada);
    }

    /**
     * Crear una nueva camionada
     * POST /api/dispatch/camionadas
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'mezcla_id' => 'required|integer|exists:mezclas,id',
            'planta_id' => 'nullable|integer|exists:plantas,id',
            'empresa_id' => 'nullable|integer|exists:empresas,id',
            'lote_id' => 'required|integer|exists:lotes,id',
            'patente' => 'required|string|max:20',
            'cliente' => 'nullable|string|max:150',
            'planta' => 'nullable|string|max:100',
            'fecha_despacho' => 'required|date',
            'hora_despacho' => 'nullable|date_format:H:i',
            'peso' => 'required|numeric|min:0.01',
            'ticket' => 'nullable|string|max:100',
            'numero_guia' => 'nullable|string|max:50',
            'ley_visual' => 'nullable|numeric|min:0',
            'ley_mezcla' => 'nullable|numeric|min:0',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $datos = $request->all();

            // Obtener user_id si existe autenticación
            try {
                $datos['user_id'] = auth()->id();
            } catch (\Exception $e) {
                $datos['user_id'] = null;
            }

            $camionada = $this->camionadaService->crearCamionada($datos);

            return response()->json([
                'mensaje' => 'Camionada registrada exitosamente',
                'camionada' => $camionada
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al crear la camionada',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar una camionada
     * PUT /api/dispatch/camionadas/{id}
     *
     * Solo se puede editar si el lote está ABIERTO
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'patente' => 'sometimes|string|max:20',
            'cliente' => 'nullable|string|max:150',
            'planta' => 'nullable|string|max:100',
            'fecha_despacho' => 'sometimes|date',
            'hora_despacho' => 'nullable|date_format:H:i',
            'peso' => 'sometimes|numeric|min:0.01',
            'ticket' => 'nullable|string|max:100',
            'numero_guia' => 'nullable|string|max:50',
            'ley_visual' => 'nullable|numeric|min:0',
            'ley_mezcla' => 'nullable|numeric|min:0',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            // Validar que el lote esté ABIERTO
            $camionada = Camionada::with('lote')->findOrFail($id);

            if ($camionada->lote && $camionada->lote->estado !== \App\Models\Laboratorio\Lote::ESTADO_ABIERTO) {
                return response()->json([
                    'error' => 'No se puede editar',
                    'mensaje' => 'No se puede editar una camionada de un lote COMPLETADO. Estado del lote: ' . $camionada->lote->estado
                ], 400);
            }

            $camionada = $this->camionadaService->actualizarCamionada($id, $request->all());

            return response()->json([
                'mensaje' => 'Camionada actualizada exitosamente',
                'camionada' => $camionada
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar la camionada',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar una camionada
     * DELETE /api/dispatch/camionadas/{id}
     *
     * Solo se puede eliminar si el lote está ABIERTO
     * Al eliminar, restaura las toneladas a la mezcla de origen
     */
    public function destroy($id)
    {
        try {
            // Validar que el lote esté ABIERTO
            $camionada = Camionada::with('lote', 'mezcla')->findOrFail($id);

            if ($camionada->lote && $camionada->lote->estado !== \App\Models\Laboratorio\Lote::ESTADO_ABIERTO) {
                return response()->json([
                    'error' => 'No se puede eliminar',
                    'mensaje' => 'No se puede eliminar una camionada de un lote COMPLETADO. Estado del lote: ' . $camionada->lote->estado
                ], 400);
            }

            // Obtener peso para el mensaje
            $pesoRestaurado = $camionada->peso_real ?? 0;
            $codigoMezcla = $camionada->mezcla ? $camionada->mezcla->codigo : 'N/A';

            $this->camionadaService->eliminarCamionada($id);

            $mensaje = 'Camionada eliminada exitosamente';
            if ($pesoRestaurado > 0) {
                $mensaje .= ". Se restauraron {$pesoRestaurado} toneladas a la mezcla {$codigoMezcla}";
            }

            return response()->json([
                'mensaje' => $mensaje
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al eliminar la camionada',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Marcar camionada como recibida
     * POST /api/dispatch/camionadas/{id}/recibir
     */
    public function marcarRecibida(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'fecha_recepcion' => 'nullable|date',
            'hora_recepcion' => 'nullable|date_format:H:i', // ✅ Formato H:i (23:59)
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $camionada = $this->camionadaService->marcarComoRecibida($id, $request->all());

            return response()->json([
                'mensaje' => 'Camionada marcada como recibida',
                'camionada' => $camionada
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al marcar la camionada',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Recepcionar camionada (con peso real y datos de recepción)
     * POST /api/dispatch/camionadas/{id}/recepcionar
     */
    public function recepcionar(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'peso_real' => 'required|numeric|min:0.01',
            'fecha_recepcion' => 'nullable|date',
            'hora_recepcion' => 'nullable|date_format:H:i',
            'ley_lab_camion' => 'nullable|numeric|min:0',
            'ticket' => 'nullable|string|max:100',
            'numero_lote' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $camionada = $this->camionadaService->recepcionarCamionada($id, $request->all());

            return response()->json([
                'mensaje' => 'Camionada recepcionada exitosamente',
                'camionada' => $camionada
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al recepcionar la camionada',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar ley de laboratorio
     * POST /api/dispatch/camionadas/{id}/ley-laboratorio
     */
    public function actualizarLeyLaboratorio(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'ley_lab_camion' => 'required|numeric|min:0'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $camionada = $this->camionadaService->actualizarLeyLaboratorio($id, $request->ley_lab_camion);

            return response()->json([
                'mensaje' => 'Ley de laboratorio actualizada',
                'camionada' => $camionada
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar ley de laboratorio',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener mezclas con remanente disponible
     * GET /api/dispatch/camionadas/mezclas-disponibles
     */
    public function mezclasDisponibles()
    {
        try {
            $mezclas = $this->camionadaService->obtenerMezclasConRemanente();

            return response()->json($mezclas);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener mezclas disponibles',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Resumen de camionadas por mezcla
     * GET /api/dispatch/mezclas/{mezclaId}/resumen-camionadas
     */
    public function resumenPorMezcla($mezclaId)
    {
        try {
            $resumen = $this->camionadaService->obtenerResumenPorMezcla($mezclaId);

            return response()->json($resumen);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener resumen',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reordenar camionadas dentro de un lote
     * POST /api/dispatch/camionadas/reordenar
     *
     * Body: { camionada_id: int, direccion: 'subir'|'bajar' }
     */
    public function reordenar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'camionada_id' => 'required|integer|exists:camionadas,id',
            'direccion' => 'required|in:subir,bajar',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $camionada = Camionada::findOrFail($request->camionada_id);

            if (!$camionada->lote_id) {
                return response()->json(['error' => 'La camionada no tiene lote asignado'], 400);
            }

            // Obtener camionadas del mismo lote ordenadas
            $camionadasLote = Camionada::where('lote_id', $camionada->lote_id)
                ->orderBy('numero_camionada', 'asc')
                ->get();

            if ($camionadasLote->count() < 2) {
                return response()->json(['mensaje' => 'No hay suficientes camionadas para reordenar']);
            }

            // Encontrar la vecina para intercambiar
            if ($request->direccion === 'subir') {
                $vecina = Camionada::where('lote_id', $camionada->lote_id)
                    ->where('numero_camionada', '<', $camionada->numero_camionada)
                    ->orderBy('numero_camionada', 'desc')
                    ->first();
            } else {
                $vecina = Camionada::where('lote_id', $camionada->lote_id)
                    ->where('numero_camionada', '>', $camionada->numero_camionada)
                    ->orderBy('numero_camionada', 'asc')
                    ->first();
            }

            if (!$vecina) {
                return response()->json(['mensaje' => 'Ya está en el límite, no se puede mover más']);
            }

            // Intercambiar numero_camionada
            $numTemp = $camionada->numero_camionada;
            $camionada->numero_camionada = $vecina->numero_camionada;
            $vecina->numero_camionada = $numTemp;

            $camionada->save();
            $vecina->save();

            return response()->json([
                'mensaje' => 'Orden actualizado',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al reordenar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

}
