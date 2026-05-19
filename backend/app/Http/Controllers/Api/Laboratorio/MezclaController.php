<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Mezcla;
use App\Services\Laboratorio\MezclaService;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;
use Illuminate\Support\Facades\Log;

class MezclaController extends Controller
{
    use MultiTenancy;
    protected $mezclaService;

    public function __construct(MezclaService $mezclaService)
    {
        $this->mezclaService = $mezclaService;
    }

    /**
     * Listar todas las mezclas
     * GET /api/mezclas
     */
    public function index(Request $request)
    {
        // Solo seleccionar campos necesarios para listado
        $query = Mezcla::with('planta:id,nombre') // Incluir relación con planta
            ->select([
                'id',
                'codigo',
                'fecha',
                'id_faena',
                'planta_id', // Agregar planta_id
                'total_ton',
                'toneladas_disponibles',
                'toneladas_despachadas',
                'ley_prom_dump',
                'ley_prom_visual',
                'ley_prom_lote',
                'ley_lab',
                'estado',
                'es_remanente',
                'mezcla_origen_id',
                'lote_origen_id',
                // Campos de ajuste
                'ajuste_aplicado',
                'total_ton_original',
                'ajuste_toneladas',
                'created_at'
            ]);

        // ✅ MULTI-FAENA: Filtrar por faena del usuario si no es global
        if (!$this->esUsuarioGlobal($request)) {
            $query->where('id_faena', $request->auth_faena);
            Log::info('🔒 [MEZCLAS] Filtrando por faena de usuario', ['id_faena' => $request->auth_faena]);
        }

        // Filtros opcionales
        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->fecha_desde);
        }

        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->fecha_hasta);
        }

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->has('codigo')) {
            $query->where('codigo', 'like', '%' . $request->codigo . '%');
        }

        $perPage = min((int) $request->get('per_page', 20), 200);
        $mezclas = $query->orderBy('fecha', 'desc')->paginate($perPage);

        return response()->json($mezclas);
    }

    /**
     * Crear una nueva mezcla (ahora acepta acopios)
     * POST /api/mezclas
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'codigo' => 'nullable|string|max:50|unique:mezclas,codigo',
            'fecha' => 'required|date',
            'id_faena' => 'nullable|integer',
            'planta_id' => 'nullable|integer|exists:plantas,id',
            'user_id' => 'nullable|integer',
            'acopios' => 'nullable|array',
            'acopios.*' => 'required|integer|exists:acopios,id',
            'dumpadas' => 'nullable|array',
            'dumpadas.*.id' => 'required|integer|exists:dumpadas,id',
            'dumpadas.*.numero_paladas' => 'nullable|numeric|min:0.01',
            'remanentes' => 'nullable|array',
            'remanentes.*.origen' => 'required|string',
            'remanentes.*.toneladas' => 'required|numeric|min:0',
            'remanentes.*.ley_dump' => 'required|numeric',
            'remanentes.*.ley_visual' => 'nullable|numeric',
            'remanentes.*.ley_lote' => 'nullable|numeric',
            'observaciones' => 'nullable|string',
            'ley_base' => 'nullable|string|in:auto,cu_insoluble,cu_soluble,cu_total',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $mezcla = $this->mezclaService->crearMezcla($request->all());

            return response()->json([
                'mensaje' => 'Mezcla creada exitosamente',
                'mezcla' => $mezcla
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al crear la mezcla',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener una mezcla específica
     * GET /api/mezclas/{id}
     */
    public function show($id)
    {
        $mezcla = Mezcla::with(['detalles.dumpada.frenteTrabajo'])->find($id);

        if (!$mezcla) {
            return response()->json(['error' => 'Mezcla no encontrada'], 404);
        }

        return response()->json($mezcla);
    }

    /**
     * Actualizar datos de una mezcla (solo campos editables)
     * PUT /api/mezclas/{id}
     */
    public function update(Request $request, $id)
    {
        $mezcla = Mezcla::find($id);

        if (!$mezcla) {
            return response()->json(['error' => 'Mezcla no encontrada'], 404);
        }

        $validator = Validator::make($request->all(), [
            'codigo' => 'sometimes|string|max:50',
            'fecha' => 'sometimes|date',
            'observaciones' => 'nullable|string',
            'estado' => 'sometimes|in:Confirmado,En Despacho,Despachado',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $mezcla = $this->mezclaService->actualizarMezcla($id, $request->all());

            return response()->json([
                'mensaje' => 'Mezcla actualizada exitosamente',
                'mezcla' => $mezcla
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar la mezcla',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar ley de laboratorio
     * POST /api/mezclas/{id}/ley-laboratorio
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
            $mezcla = $this->mezclaService->actualizarLeyLaboratorio($id, $request->ley_lab);

            return response()->json([
                'mensaje' => 'Ley de laboratorio actualizada',
                'mezcla' => $mezcla
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar ley de laboratorio',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Agregar dumpadas a una mezcla existente.
     * Acepta dumpadas completas o con número de paladas parciales.
     * POST /api/mezclas/{id}/agregar-dumpadas
     *
     * Formato nuevo:
     * { "dumpadas": [{"id": 1, "numero_paladas": 3}, {"id": 2, "numero_paladas": null}] }
     *
     * numero_paladas = null → dumpada completa (comportamiento legado)
     * numero_paladas > 0   → solo esas paladas de la dumpada
     */
    public function agregarDumpadas(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'dumpadas' => 'required|array|min:1',
            'dumpadas.*.id' => 'required|integer|exists:dumpadas,id',
            'dumpadas.*.numero_paladas' => 'nullable|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $mezcla = $this->mezclaService->agregarDumpadas($id, $request->dumpadas);

            return response()->json([
                'mensaje' => 'Dumpadas agregadas exitosamente',
                'mezcla' => $mezcla
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al agregar dumpadas',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Agregar remanente a una mezcla
     * POST /api/mezclas/{id}/agregar-remanente
     */
    public function agregarRemanente(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'origen' => 'required|string',
            'toneladas' => 'required|numeric|min:0',
            'ley_dump' => 'required|numeric',
            'ley_visual' => 'nullable|numeric',
            'ley_lote' => 'nullable|numeric',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $mezcla = $this->mezclaService->agregarRemanente($id, $request->all());

            return response()->json([
                'mensaje' => 'Remanente agregado exitosamente',
                'mezcla' => $mezcla
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al agregar remanente',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Editar un detalle (remanente) de una mezcla
     * PUT /api/mezclas/{mezclaId}/detalles/{detalleId}
     */
    public function editarDetalle(Request $request, $mezclaId, $detalleId)
    {
        $validator = Validator::make($request->all(), [
            'toneladas' => 'sometimes|numeric|min:0',
            'ley_dump' => 'sometimes|numeric',
            'ley_visual' => 'sometimes|numeric',
            'ley_lote' => 'sometimes|numeric',
            'origen' => 'sometimes|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $mezcla = $this->mezclaService->editarDetalle($mezclaId, $detalleId, $request->all());

            return response()->json([
                'mensaje' => 'Detalle editado exitosamente',
                'mezcla' => $mezcla
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al editar detalle',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar un detalle (dumpada o remanente) de una mezcla
     * DELETE /api/mezclas/{mezclaId}/detalles/{detalleId}
     */
    public function eliminarDetalle($mezclaId, $detalleId)
    {
        try {
            $mezcla = $this->mezclaService->eliminarDetalle($mezclaId, $detalleId);

            return response()->json([
                'mensaje' => 'Detalle eliminado exitosamente',
                'mezcla' => $mezcla
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al eliminar detalle',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener dumpadas disponibles (no asignadas a mezclas)
     * GET /api/mezclas/dumpadas-disponibles
     */
    public function dumpadasDisponibles(Request $request)
    {
        // ✅ MULTI-FAENA: Forzar id_faena del usuario si no es global
        $filtros = $request->only(['fecha_desde', 'fecha_hasta', 'id_faena']);
        if (!$this->esUsuarioGlobal($request)) {
            $filtros['id_faena'] = $request->auth_faena;
        }

        Log::info('🔍 [MEZCLAS] Solicitando dumpadas disponibles', [
            'filtros' => $filtros,
            'es_global' => $this->esUsuarioGlobal($request)
        ]);

        $dumpadas = $this->mezclaService->obtenerDumpadasDisponibles($filtros);

        Log::info('✅ [MEZCLAS] Dumpadas disponibles encontradas', [
            'cantidad' => $dumpadas->count(),
            'ids' => $dumpadas->pluck('id')->toArray()
        ]);

        return response()->json($dumpadas);
    }

    /**
     * Obtener mezclas con remanentes disponibles
     * GET /api/mezclas/remanentes-disponibles
     *
     * Un remanente es una mezcla que:
     * 1. Ya ha sido despachada parcialmente (toneladas_despachadas > 0)
     * 2. Aún tiene material disponible (toneladas_disponibles > 0)
     * 3. Es de un lote que fue cerrado (estado En Despacho o Despachado)
     */
    public function remanentesDisponibles(Request $request)
    {
        try {
            $query = Mezcla::where('toneladas_disponibles', '>', 0.01)
                ->where('toneladas_despachadas', '>', 0) // Solo si ya se despachó algo
                ->whereIn('estado', ['En Despacho', 'Despachado']) // Solo mezclas en proceso o completadas
                ->where('es_descarte', false) // Excluir descartados
                ->select([
                    'id',
                    'codigo',
                    'fecha',
                    'id_faena',
                    'total_ton',
                    'toneladas_disponibles',
                    'toneladas_despachadas',
                    'ley_prom_dump',
                    'ley_prom_visual',
                    'ley_prom_lote',
                    'ley_lab',
                    'estado',
                    'es_descarte',
                    'ajuste_aplicado'
                ]);

            // ✅ MULTI-FAENA: Filtrar por faena del usuario si no es global
            if (!$this->esUsuarioGlobal($request)) {
                $query->where('id_faena', $request->auth_faena);
                Log::info('🔒 [MEZCLAS REMANENTES] Filtrando por faena de usuario', ['id_faena' => $request->auth_faena]);
            }

            $mezclas = $query->orderBy('fecha', 'desc')->get();

            return response()->json($mezclas);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al obtener mezclas con remanentes',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generar reporte de mezcla
     * GET /api/mezclas/{id}/reporte
     */
    public function reporte($id)
    {
        try {
            $reporte = $this->mezclaService->generarReporte($id);

            return response()->json($reporte);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al generar reporte',
                'mensaje' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Marcar mezcla como descarte
     * POST /api/mezclas/{id}/marcar-descarte
     */
    public function marcarDescarte($id)
    {
        try {
            $mezcla = Mezcla::findOrFail($id);

            // Verificar que sea un remanente válido
            if ($mezcla->toneladas_disponibles <= 0.01) {
                return response()->json([
                    'error' => 'La mezcla no tiene toneladas disponibles para descartar'
                ], 400);
            }

            $mezcla->es_descarte = true;
            $mezcla->save();

            return response()->json([
                'mensaje' => 'Remanente marcado como descarte exitosamente',
                'mezcla' => $mezcla
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al marcar como descarte',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar una mezcla
     * DELETE /api/mezclas/{id}
     *
     * Solo se puede eliminar si NO tiene camionadas recepcionadas
     * Si tiene camionadas no recepcionadas, se eliminan en cascada
     * IMPORTANTE: Restaura toneladas a mezclas origen y libera acopios
     */
    public function destroy($id)
    {
        $mezcla = Mezcla::with(['camionadas', 'detalles'])->find($id);

        if (!$mezcla) {
            return response()->json(['error' => 'Mezcla no encontrada'], 404);
        }

        // Verificar si tiene camionadas recepcionadas (con peso_real)
        $camionadasRecepcionadas = $mezcla->camionadas()
            ->whereNotNull('peso_real')
            ->count();

        if ($camionadasRecepcionadas > 0) {
            return response()->json([
                'error' => 'No se puede eliminar la mezcla',
                'mensaje' => "La mezcla tiene {$camionadasRecepcionadas} camionada(s) ya recepcionada(s). No es posible eliminarla."
            ], 400);
        }

        // PASO 1: Restaurar toneladas de remanentes a mezclas origen
        $remanentes = $mezcla->detalles()->where('tipo', 'REM')->get();
        foreach ($remanentes as $remanente) {
            // Buscar mezcla origen por el texto "Remanente de CZ1001"
            if (preg_match('/Remanente de (.+)/', $remanente->origen, $matches)) {
                $codigoMezclaOrigen = $matches[1];
                $mezclaOrigen = Mezcla::where('codigo', $codigoMezclaOrigen)->first();

                if ($mezclaOrigen) {
                    $mezclaOrigen->restaurarToneladas($remanente->toneladas);
                }
            }
        }

        // PASO 2: Liberar acopios que estaban EN_MEZCLA
        $dumpadasIds = $mezcla->detalles()
            ->where('tipo', 'DUMP')
            ->whereNotNull('dumpada_id')
            ->pluck('dumpada_id')
            ->toArray();

        if (!empty($dumpadasIds)) {
            // Buscar acopios que contengan estas dumpadas
            $acopios = \App\Models\Dispatch\Acopio::whereHas('dumpadas', function($q) use ($dumpadasIds) {
                $q->whereIn('dumpadas.id', $dumpadasIds);
            })->where('estado', 'EN_MEZCLA')->get();

            foreach ($acopios as $acopio) {
                $acopio->update(['estado' => 'CERRADO']);
            }
        }

        // PASO 3: Eliminar camionadas no recepcionadas
        $mezcla->camionadas()->delete();

        // PASO 4: Eliminar la mezcla
        $mezcla->delete();

        return response()->json([
            'mensaje' => 'Mezcla eliminada exitosamente',
            'toneladas_restauradas' => $remanentes->sum('toneladas'),
            'acopios_liberados' => $acopios->count() ?? 0
        ]);
    }

    /**
     * Aplicar ajuste manual de toneladas a una mezcla
     * POST /api/mezclas/{id}/ajustar-toneladas
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function aplicarAjusteToneladas(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'toneladas_reales_remanente' => 'required|numeric|min:0',
                'motivo' => 'required|string|min:10|max:500',
            ], [
                'toneladas_reales_remanente.required' => 'Las toneladas reales del remanente son obligatorias',
                'toneladas_reales_remanente.numeric' => 'Las toneladas deben ser un número',
                'toneladas_reales_remanente.min' => 'Las toneladas no pueden ser negativas',
                'motivo.required' => 'El motivo del ajuste es obligatorio',
                'motivo.min' => 'El motivo debe tener al menos 10 caracteres',
                'motivo.max' => 'El motivo no puede exceder 500 caracteres',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos de validación incorrectos',
                    'detalles' => $validator->errors()
                ], 422);
            }

            $mezcla = $this->mezclaService->aplicarAjusteToneladas(
                $id,
                $request->toneladas_reales_remanente,
                $request->motivo,
                $request->user()->id ?? null
            );

            return response()->json([
                'mensaje' => 'Ajuste de toneladas aplicado exitosamente',
                'mezcla' => [
                    'id' => $mezcla->id,
                    'codigo' => $mezcla->codigo,
                    'total_ton_original' => $mezcla->total_ton_original,
                    'total_ton' => $mezcla->total_ton,
                    'ajuste_toneladas' => $mezcla->ajuste_toneladas,
                    'toneladas_disponibles' => $mezcla->toneladas_disponibles,
                    'toneladas_despachadas' => $mezcla->toneladas_despachadas,
                    'motivo_ajuste' => $mezcla->motivo_ajuste,
                    'fecha_ajuste' => $mezcla->fecha_ajuste,
                ]
            ], 200);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al aplicar el ajuste',
                'mensaje' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Revertir el ajuste de toneladas de una mezcla
     * POST /api/mezclas/{id}/revertir-ajuste
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function revertirAjusteToneladas(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'motivo' => 'required|string|min:10|max:500',
            ], [
                'motivo.required' => 'El motivo de la reversión es obligatorio',
                'motivo.min' => 'El motivo debe tener al menos 10 caracteres',
                'motivo.max' => 'El motivo no puede exceder 500 caracteres',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos de validación incorrectos',
                    'detalles' => $validator->errors()
                ], 422);
            }

            $mezcla = $this->mezclaService->revertirAjusteToneladas(
                $id,
                $request->motivo,
                $request->user()->id ?? null
            );

            return response()->json([
                'mensaje' => 'Ajuste revertido exitosamente',
                'mezcla' => [
                    'id' => $mezcla->id,
                    'codigo' => $mezcla->codigo,
                    'total_ton' => $mezcla->total_ton,
                    'toneladas_disponibles' => $mezcla->toneladas_disponibles,
                    'toneladas_despachadas' => $mezcla->toneladas_despachadas,
                    'ajuste_aplicado' => $mezcla->ajuste_aplicado,
                ]
            ], 200);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al revertir el ajuste',
                'mensaje' => $e->getMessage()
            ], 400);
        }
    }
}
