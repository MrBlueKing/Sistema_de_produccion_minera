<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Lote;
use App\Services\Laboratorio\LoteService;
use App\Services\Laboratorio\CamionadaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class LoteController extends Controller
{
    protected $loteService;
    protected $camionadaService;

    public function __construct(LoteService $loteService, CamionadaService $camionadaService)
    {
        $this->loteService = $loteService;
        $this->camionadaService = $camionadaService;
    }

    /**
     * Listar todos los lotes con paginación y búsqueda
     * GET /api/dispatch/lotes
     *
     * Parámetros:
     * - planta_id: Filtrar por planta
     * - empresa_id: Filtrar por empresa
     * - estado: Filtrar por estado (Abierto/Completado)
     * - fecha_desde: Filtrar por fecha desde
     * - fecha_hasta: Filtrar por fecha hasta
     * - search: Búsqueda por número lote, planta o empresa
     * - page: Número de página
     * - per_page: Registros por página (default: 20)
     */
    public function index(Request $request)
    {
        $query = Lote::with(['planta', 'empresa', 'camionadas']);

        // Búsqueda por texto
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('numero_lote', 'like', "%{$search}%")
                  ->orWhereHas('planta', function ($q2) use ($search) {
                      $q2->where('nombre', 'like', "%{$search}%")
                         ->orWhere('codigo', 'like', "%{$search}%");
                  })
                  ->orWhereHas('empresa', function ($q2) use ($search) {
                      $q2->where('nombre', 'like', "%{$search}%")
                         ->orWhere('codigo', 'like', "%{$search}%");
                  });
            });
        }

        // Filtros opcionales
        if ($request->has('planta_id') && !empty($request->planta_id)) {
            $query->where('planta_id', $request->planta_id);
        }

        if ($request->has('empresa_id') && !empty($request->empresa_id)) {
            $query->where('empresa_id', $request->empresa_id);
        }

        if ($request->has('estado') && !empty($request->estado)) {
            $query->where('estado', $request->estado);
        }

        if ($request->has('fecha_desde') && !empty($request->fecha_desde)) {
            $query->where('fecha_creacion', '>=', $request->fecha_desde);
        }

        if ($request->has('fecha_hasta') && !empty($request->fecha_hasta)) {
            $query->where('fecha_creacion', '<=', $request->fecha_hasta);
        }

        // Ordenamiento
        $query->orderBy('fecha_creacion', 'desc');

        // Paginación (solo si se especifica page)
        $perPage = $request->get('per_page', 20);

        if ($request->has('page')) {
            $lotes = $query->paginate($perPage);

            // Agregar campos calculados a cada lote
            $lotes->getCollection()->transform(function ($lote) {
                return $this->agregarCamposCalculados($lote);
            });

            return response()->json($lotes);
        } else {
            // Sin paginación (para lotes abiertos que son pocos)
            $lotes = $query->get();

            $lotesTransformados = $lotes->map(function ($lote) {
                return $this->agregarCamposCalculados($lote);
            });

            return response()->json($lotesTransformados);
        }
    }

    /**
     * Agregar campos calculados a un lote
     */
    private function agregarCamposCalculados($lote)
    {
        $loteData = $lote->toArray();
        $loteData['todas_recepcionadas'] = $lote->todasCamionadasRecepcionadas();
        $loteData['peso_total'] = $lote->getPesoTotal();
        $loteData['peso_recibido'] = $lote->getPesoRecibido();
        $loteData['remanente'] = $lote->getRemanente();
        $loteData['numero_camionadas'] = $lote->getNumeroCamionadas();

        // Calcular camionadas recepcionadas
        $camionadasRecepcionadas = $lote->camionadas()
            ->whereIn('estado', [
                \App\Models\Laboratorio\Camionada::ESTADO_RECIBIDO,
                \App\Models\Laboratorio\Camionada::ESTADO_COMPLETADO
            ])
            ->count();
        $loteData['camionadas_recepcionadas'] = $camionadasRecepcionadas;

        // Calcular leyes promedio ponderadas
        $loteData['ley_lote_promedio'] = $lote->getLeyLotePromedio();
        $loteData['ley_lab_promedio'] = $lote->getLeyLabPromedio();
        $loteData['ley_visual_promedio'] = $lote->getLeyVisualPromedio();

        // Agregar nombres para cuando no se cargan las relaciones
        if ($lote->planta) {
            $loteData['planta_nombre'] = $lote->planta->nombre;
        }
        if ($lote->empresa) {
            $loteData['empresa_nombre'] = $lote->empresa->nombre;
        }

        return $loteData;
    }

    /**
     * Crear un nuevo lote
     * POST /api/dispatch/lotes
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'numero_lote' => 'nullable|string|max:50|unique:lotes,numero_lote',
            'planta_id' => 'required|integer|exists:plantas,id',
            'empresa_id' => 'required|integer|exists:empresas,id',
            'fecha_creacion' => 'nullable|date',
            'fecha_estimada_llegada' => 'nullable|date',
            'observaciones' => 'nullable|string',
            'user_id' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = $this->loteService->crearLote($request->all());

            return response()->json([
                'mensaje' => 'Lote creado exitosamente',
                'lote' => $lote
            ], 201);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al crear el lote',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener un lote específico
     * GET /api/dispatch/lotes/{id}
     */
    public function show($id)
    {
        $lote = Lote::with(['planta', 'empresa', 'camionadas.mezcla'])->findOrFail($id);

        // Agregar campos calculados
        $loteData = $this->agregarCamposCalculados($lote);

        return response()->json($loteData);
    }

    /**
     * Actualizar un lote
     * PUT /api/dispatch/lotes/{id}
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'numero_lote' => 'sometimes|string|max:50|unique:lotes,numero_lote,' . $id,
            'planta_id' => 'sometimes|integer|exists:plantas,id',
            'fecha_creacion' => 'sometimes|date',
            'fecha_estimada_llegada' => 'sometimes|date',
            'estado' => 'sometimes|in:Abierto,Completado',
            'empresa_id' => 'sometimes|integer|exists:empresas,id',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = $this->loteService->actualizarLote($id, $request->all());

            return response()->json([
                'mensaje' => 'Lote actualizado exitosamente',
                'lote' => $lote
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar el lote',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar un lote con opciones para las camionadas
     * DELETE /api/dispatch/lotes/{id}?opcion=reasignar|eliminar_camionadas|dejar_huerfanas
     *
     * Solo se pueden eliminar lotes en estado ABIERTO
     *
     * Opciones:
     * - reasignar: Busca o crea otro lote ABIERTO y reasigna las camionadas
     * - eliminar_camionadas: Elimina todas las camionadas (restaura toneladas a mezclas)
     * - dejar_huerfanas: Deja las camionadas sin lote (lote_id = NULL)
     */
    public function destroy(Request $request, $id)
    {
        try {
            $lote = Lote::with(['camionadas.mezcla', 'planta', 'empresa'])->findOrFail($id);

            // Validar que solo se puedan eliminar lotes ABIERTOS
            if ($lote->estado !== Lote::ESTADO_ABIERTO) {
                return response()->json([
                    'error' => 'No se puede eliminar',
                    'mensaje' => 'Solo se pueden eliminar lotes en estado ABIERTO. Este lote está en estado: ' . $lote->estado
                ], 400);
            }

            $cantidadCamionadas = $lote->camionadas()->count();
            $opcion = $request->input('opcion', 'dejar_huerfanas'); // Default: dejar huérfanas

            \DB::beginTransaction();

            if ($cantidadCamionadas > 0) {
                switch ($opcion) {
                    case 'reasignar':
                        // Buscar o crear otro lote ABIERTO para la misma planta+empresa
                        $nuevoLote = Lote::where('planta_id', $lote->planta_id)
                            ->where('empresa_id', $lote->empresa_id)
                            ->where('estado', Lote::ESTADO_ABIERTO)
                            ->where('id', '!=', $lote->id) // Excluir el lote actual
                            ->orderBy('created_at', 'desc')
                            ->first();

                        // Si no existe, crear uno nuevo
                        if (!$nuevoLote) {
                            $numeroLote = Lote::generarNumeroLote($lote->planta_id);
                            $nuevoLote = Lote::create([
                                'numero_lote' => $numeroLote,
                                'planta_id' => $lote->planta_id,
                                'empresa_id' => $lote->empresa_id,
                                'fecha_creacion' => now(),
                                'estado' => Lote::ESTADO_ABIERTO,
                            ]);
                        }

                        // Reasignar camionadas al nuevo lote
                        $lote->camionadas()->update(['lote_id' => $nuevoLote->id]);

                        $mensaje = "Lote eliminado exitosamente. {$cantidadCamionadas} camionada(s) reasignada(s) al lote {$nuevoLote->numero_lote}";
                        break;

                    case 'eliminar_camionadas':
                        // Eliminar cada camionada usando el servicio (esto restaura toneladas a sus mezclas)
                        $totalToneladasRestauradas = 0;
                        foreach ($lote->camionadas as $camionada) {
                            if ($camionada->peso_real) {
                                $totalToneladasRestauradas += $camionada->peso_real;
                            }
                            // Usar el servicio para eliminar (restaura toneladas automáticamente)
                            $this->camionadaService->eliminarCamionada($camionada->id);
                        }

                        $mensaje = "Lote eliminado exitosamente. {$cantidadCamionadas} camionada(s) eliminada(s)";
                        if ($totalToneladasRestauradas > 0) {
                            $mensaje .= " y " . number_format($totalToneladasRestauradas, 2) . " toneladas restauradas a sus mezclas";
                        }
                        break;

                    case 'dejar_huerfanas':
                    default:
                        // Desvincular camionadas (lote_id = NULL)
                        $lote->camionadas()->update(['lote_id' => null]);
                        $mensaje = "Lote eliminado exitosamente. {$cantidadCamionadas} camionada(s) desvinculada(s) (quedan sin lote asignado)";
                        break;
                }
            } else {
                $mensaje = "Lote eliminado exitosamente (no tenía camionadas)";
            }

            // Eliminar el lote
            $lote->delete();

            \DB::commit();

            return response()->json([
                'mensaje' => $mensaje
            ]);

        } catch (\Exception $e) {
            \DB::rollBack();

            return response()->json([
                'error' => 'Error al eliminar el lote',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener resumen del lote
     * GET /api/dispatch/lotes/{id}/resumen
     */
    public function resumen($id)
    {
        try {
            $resumen = $this->loteService->obtenerResumen($id);

            return response()->json($resumen);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al obtener resumen',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cerrar lote manualmente
     * POST /api/dispatch/lotes/{id}/cerrar
     *
     * Parámetros opcionales:
     * - numero_paladas: Número de paladas recogidas del suelo
     * - toneladas_remanente: Toneladas del remanente (alternativa a numero_paladas)
     * - observaciones_remanente: Observaciones del remanente creado
     */
    public function cerrar(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'numero_paladas' => 'nullable|integer|min:1',
            'toneladas_remanente' => 'nullable|numeric|min:0.01',
            'observaciones_remanente' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = Lote::findOrFail($id);
            $resultado = $lote->cerrar($request->all());

            return response()->json([
                'mensaje' => 'Lote cerrado exitosamente',
                'lote' => $lote->load(['planta', 'empresa', 'camionadas']),
                'remanentes_disponibles' => $resultado['remanentes_disponibles'],
                'remanente_creado' => $resultado['remanente_creado'] ?? null
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al cerrar el lote',
                'mensaje' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Obtener lotes abiertos por planta y empresa
     * GET /api/dispatch/lotes/abiertos
     */
    public function lotesAbiertos(Request $request)
    {
        $query = Lote::with(['planta', 'empresa'])
            ->where('estado', Lote::ESTADO_ABIERTO);

        if ($request->has('planta_id') && !empty($request->planta_id)) {
            $query->where('planta_id', $request->planta_id);
        }

        if ($request->has('empresa_id') && !empty($request->empresa_id)) {
            $query->where('empresa_id', $request->empresa_id);
        }

        $lotes = $query->orderBy('created_at', 'desc')->get();

        return response()->json($lotes);
    }

    /**
     * Obtener lotes abiertos con sus camionadas (para vista cards)
     * GET /api/dispatch/lotes/abiertos-con-camionadas
     */
    public function lotesAbiertosConCamionadas(Request $request)
    {
        $query = Lote::with(['planta', 'empresa', 'camionadas.mezcla'])
            ->where('estado', Lote::ESTADO_ABIERTO);

        if ($request->has('planta_id') && !empty($request->planta_id)) {
            $query->where('planta_id', $request->planta_id);
        }

        if ($request->has('empresa_id') && !empty($request->empresa_id)) {
            $query->where('empresa_id', $request->empresa_id);
        }

        $lotes = $query->orderBy('created_at', 'desc')->get();

        $lotesTransformados = $lotes->map(function ($lote) {
            return $this->agregarCamposCalculados($lote);
        });

        return response()->json($lotesTransformados);
    }
}
