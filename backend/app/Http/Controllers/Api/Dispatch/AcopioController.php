<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Acopio;
use App\Services\Dispatch\AcopioService;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class AcopioController extends Controller
{
    use MultiTenancy;

    protected $acopioService;

    public function __construct(AcopioService $acopioService)
    {
        $this->acopioService = $acopioService;
    }

    /**
     * Listar todos los acopios con filtros
     */
    public function index(Request $request)
    {
        try {
            $perPage = $request->get('per_page', 15);
            $tipo = $request->get('tipo');
            $estado = $request->get('estado');
            $search = $request->get('search');

            $query = Acopio::with('frenteTrabajo', 'dumpadas')
                ->orderBy('created_at', 'desc');

            // MULTI-FAENA: Aplicar filtro automático de faena
            $this->aplicarFiltroFaena($query, $request);

            // Filtro por tipo
            if ($tipo) {
                $query->where('tipo', $tipo);
            }

            // Filtro por estado
            if ($estado) {
                $query->where('estado', $estado);
            }

            // Búsqueda
            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('numero_acopio', 'like', '%' . $search . '%')
                        ->orWhere('codigo_acopio', 'like', '%' . $search . '%')
                        ->orWhere('nombre', 'like', '%' . $search . '%');
                });
            }

            $acopios = $query->paginate($perPage);

            // Recalcular totales de cada acopio para asegurar que estén actualizados
            foreach ($acopios as $acopio) {
                $acopio->recalcularTotales();
            }

            // Recargar los acopios para obtener los valores actualizados
            $idsAcopios = collect($acopios->items())->pluck('id');
            $acopiosActualizados = Acopio::with('frenteTrabajo', 'dumpadas')
                ->whereIn('id', $idsAcopios)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $acopiosActualizados,
                'pagination' => [
                    'total' => $acopios->total(),
                    'per_page' => $acopios->perPage(),
                    'current_page' => $acopios->currentPage(),
                    'last_page' => $acopios->lastPage(),
                    'from' => $acopios->firstItem(),
                    'to' => $acopios->lastItem()
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error al listar acopios', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al listar acopios',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Ver un acopio específico
     */
    public function show($id)
    {
        try {
            $acopio = Acopio::with('frenteTrabajo', 'dumpadas.frenteTrabajo')
                ->findOrFail($id);

            // Recalcular totales para asegurar que estén actualizados
            $acopio->recalcularTotales();

            // Recargar el acopio con las relaciones
            $acopio = Acopio::with('frenteTrabajo', 'dumpadas.frenteTrabajo')
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $acopio
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Acopio no encontrado',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Detectar acopios existentes para dumpadas
     * POST /api/acopios/detectar-existentes
     */
    public function detectarExistentes(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'dumpadas' => 'required|array',
                'dumpadas.*.id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
                'dumpadas.*.jornada' => 'required|in:AM,PM,Madrugada,Noche',
                'dumpadas.*.fecha' => 'required|date',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $grupos = $this->acopioService->detectarAcopiosExistentes($request->dumpadas);

            return response()->json([
                'success' => true,
                'data' => $grupos
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error al detectar acopios existentes', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al detectar acopios existentes',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear un nuevo acopio automático
     * POST /api/acopios/automatico
     */
    public function crearAutomatico(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
                'jornada' => 'required|in:AM,PM,Madrugada,Noche',
                'fecha' => 'required|date',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $acopio = $this->acopioService->crearAcopioAutomatico(
                $request->id_frente_trabajo,
                $request->jornada,
                $request->fecha,
                $request->auth_user_id
            );

            return response()->json([
                'success' => true,
                'message' => 'Acopio automático creado exitosamente',
                'data' => $acopio
            ], 201);

        } catch (\Exception $e) {
            Log::error('Error al crear acopio automático', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al crear acopio automático',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear un acopio manual
     * POST /api/acopios/manual
     */
    public function crearManual(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'nombre' => 'nullable|string|max:200',
                'observaciones' => 'nullable|string',
                'dumpada_ids' => 'required|array',
                'dumpada_ids.*' => 'exists:dumpadas,id',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $acopio = $this->acopioService->crearAcopioManual(
                [
                    'nombre' => $request->nombre,
                    'observaciones' => $request->observaciones,
                ],
                $request->dumpada_ids,
                $request->auth_user_id
            );

            return response()->json([
                'success' => true,
                'message' => 'Acopio manual creado exitosamente',
                'data' => $acopio
            ], 201);

        } catch (\Exception $e) {
            Log::error('Error al crear acopio manual', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al crear acopio manual',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Agregar dumpadas a un acopio existente
     * POST /api/acopios/{id}/agregar-dumpadas
     */
    public function agregarDumpadas(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'dumpada_ids' => 'required|array',
                'dumpada_ids.*' => 'exists:dumpadas,id',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $acopio = $this->acopioService->agregarDumpadas($id, $request->dumpada_ids);

            return response()->json([
                'success' => true,
                'message' => 'Dumpadas agregadas exitosamente',
                'data' => $acopio
            ], 200);

        } catch (\Exception $e) {
            Log::error('Error al agregar dumpadas al acopio', [
                'acopio_id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Quitar dumpadas de un acopio
     * POST /api/acopios/{id}/quitar-dumpadas
     */
    public function quitarDumpadas(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'dumpada_ids' => 'required|array',
                'dumpada_ids.*' => 'exists:dumpadas,id',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $acopio = $this->acopioService->quitarDumpadas($id, $request->dumpada_ids);

            return response()->json([
                'success' => true,
                'message' => 'Dumpadas quitadas exitosamente',
                'data' => $acopio
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Cerrar un acopio
     * POST /api/acopios/{id}/cerrar
     */
    public function cerrar($id)
    {
        try {
            $acopio = Acopio::with('dumpadas')->findOrFail($id);

            // Verificar si puede cerrarse antes de intentar
            if (!$acopio->puedeCerrarse()) {
                // Contar cuántas dumpadas no tienen ley
                $dumpadasSinLey = $acopio->dumpadas->filter(function($d) {
                    $tieneLey = !empty($d->ley) && $d->ley > 0;
                    $tieneLeyVisual = !empty($d->ley_visual) && $d->ley_visual > 0;
                    return !$tieneLey && !$tieneLeyVisual;
                })->count();

                return response()->json([
                    'success' => false,
                    'message' => "No se puede cerrar el acopio. {$dumpadasSinLey} dumpada(s) no tienen ley de laboratorio ni ley visual."
                ], 400);
            }

            $acopio = $this->acopioService->cerrarAcopio($id);

            return response()->json([
                'success' => true,
                'message' => 'Acopio cerrado exitosamente',
                'data' => $acopio
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Reabrir un acopio
     * POST /api/acopios/{id}/reabrir
     */
    public function reabrir($id)
    {
        try {
            $acopio = $this->acopioService->reabrirAcopio($id);

            return response()->json([
                'success' => true,
                'message' => 'Acopio reabierto exitosamente',
                'data' => $acopio
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Obtener acopios disponibles para mezclas
     * GET /api/acopios/disponibles
     */
    public function disponibles()
    {
        try {
            $acopios = $this->acopioService->obtenerAcopiosDisponibles();

            return response()->json([
                'success' => true,
                'data' => $acopios
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener acopios disponibles',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener dumpadas sin acopio
     * GET /api/acopios/dumpadas-sin-acopio
     */
    public function dumpadasSinAcopio()
    {
        try {
            $dumpadas = $this->acopioService->obtenerDumpadasSinAcopio();

            return response()->json([
                'success' => true,
                'data' => $dumpadas
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener dumpadas sin acopio',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verificar si un acopio puede cerrarse
     * GET /api/acopios/{id}/puede-cerrarse
     */
    public function puedeCerrarse($id)
    {
        try {
            $acopio = Acopio::with('dumpadas')->findOrFail($id);
            $puedeCerrarse = $acopio->puedeCerrarse();

            // Obtener información detallada
            $dumpadasSinLey = $acopio->dumpadas->filter(function($d) {
                $tieneLey = !empty($d->ley) && $d->ley > 0;
                $tieneLeyVisual = !empty($d->ley_visual) && $d->ley_visual > 0;
                return !$tieneLey && !$tieneLeyVisual;
            });

            return response()->json([
                'success' => true,
                'puede_cerrarse' => $puedeCerrarse,
                'total_dumpadas' => $acopio->dumpadas->count(),
                'dumpadas_sin_ley' => $dumpadasSinLey->count(),
                'dumpadas_sin_ley_detalle' => $dumpadasSinLey->map(function($d) {
                    return [
                        'id' => $d->id,
                        'numero_dumpada' => $d->numero_dumpada,
                        'ley' => $d->ley,
                        'ley_visual' => $d->ley_visual
                    ];
                })->values()
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al verificar el acopio',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar un acopio
     * DELETE /api/acopios/{id}
     */
    public function destroy($id)
    {
        try {
            $acopio = Acopio::with('dumpadas')->findOrFail($id);

            if ($acopio->estado === Acopio::ESTADO_EN_MEZCLA) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede eliminar un acopio que está en una mezcla'
                ], 400);
            }

            // Limpiar el campo 'acopios' de todas las dumpadas asociadas
            // antes de que la cascada elimine las relaciones
            foreach ($acopio->dumpadas as $dumpada) {
                $dumpada->update(['acopios' => null]);
            }

            // Eliminar el acopio
            // La cascada en la tabla pivot 'acopio_dumpada' eliminará automáticamente las relaciones
            $acopio->delete();

            return response()->json([
                'success' => true,
                'message' => 'Acopio eliminado exitosamente'
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar acopio',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
