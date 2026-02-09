<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Tronadura;
use App\Models\Dispatch\Dumpada;
use App\Models\Ingenieria\FrenteTrabajo;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class TronaduraController extends Controller
{
    use MultiTenancy;
    /**
     * Listar todas las tronaduras con filtros
     * GET /api/dispatch/tronaduras
     */
    public function index(Request $request)
    {
        $query = Tronadura::with(['frenteTrabajo:id,codigo_completo', 'dumpadas:id,tronadura_id,ton,ley']);

        // MULTI-FAENA: Aplicar filtro automático de faena
        $this->aplicarFiltroFaena($query, $request);

        // Filtros
        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->fecha_desde);
        }

        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->fecha_hasta);
        }

        if ($request->has('id_frente_trabajo')) {
            $query->where('id_frente_trabajo', $request->id_frente_trabajo);
        }

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->has('codigo')) {
            $query->where('codigo', 'like', '%' . $request->codigo . '%');
        }

        $tronaduras = $query->orderBy('fecha', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($request->get('per_page', 15));

        // Agregar atributos calculados
        $tronaduras->getCollection()->transform(function ($tronadura) {
            $tronadura->ley_promedio = $tronadura->ley_promedio;
            $tronadura->porcentaje_extraccion = $tronadura->porcentaje_extraccion;
            return $tronadura;
        });

        return response()->json($tronaduras);
    }

    /**
     * Crear una nueva tronadura
     * POST /api/dispatch/tronaduras
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => 'required|integer|exists:frentes_trabajo,id',
            'fecha' => 'required|date',
            'hora' => 'nullable|date_format:H:i',
            'jornada' => 'nullable|string|in:AM,PM,Madrugada,Noche',
            'toneladas_estimadas' => 'nullable|numeric|min:0',
            'dumpadas_estimadas' => 'nullable|integer|min:0',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            // MULTI-FAENA: Obtener frente y validar acceso
            $frente = FrenteTrabajo::findOrFail($request->id_frente_trabajo);
            $this->validarAccesoFaena($request, $frente->id_faena);

            $tronadura = Tronadura::create([
                'codigo' => Tronadura::generarCodigo(),
                'id_frente_trabajo' => $request->id_frente_trabajo,
                'id_faena' => $frente->id_faena,
                'fecha' => $request->fecha,
                'hora' => $request->hora,
                'jornada' => $request->jornada,
                'toneladas_estimadas' => $request->toneladas_estimadas,
                'dumpadas_estimadas' => $request->dumpadas_estimadas,
                'toneladas_reales' => 0,
                'dumpadas_reales' => 0,
                'estado' => Tronadura::ESTADO_ACTIVA,
                'observaciones' => $request->observaciones,
                'user_id' => auth()->id(),
            ]);

            $tronadura->load('frenteTrabajo:id,codigo_completo');

            return response()->json([
                'mensaje' => 'Tronadura creada exitosamente',
                'tronadura' => $tronadura
            ], 201);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al crear la tronadura',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener una tronadura específica con sus dumpadas
     * GET /api/dispatch/tronaduras/{id}
     */
    public function show($id)
    {
        $tronadura = Tronadura::with([
            'frenteTrabajo:id,codigo_completo',
            'dumpadas:id,tronadura_id,n_acop,acopios,fecha,ton,ley,ley_visual,estado',
            'usuario:id,name'
        ])->find($id);

        if (!$tronadura) {
            return response()->json(['error' => 'Tronadura no encontrada'], 404);
        }

        // Agregar atributos calculados
        $tronadura->ley_promedio = $tronadura->ley_promedio;
        $tronadura->porcentaje_extraccion = $tronadura->porcentaje_extraccion;

        return response()->json($tronadura);
    }

    /**
     * Actualizar una tronadura
     * PUT /api/dispatch/tronaduras/{id}
     */
    public function update(Request $request, $id)
    {
        $tronadura = Tronadura::find($id);

        if (!$tronadura) {
            return response()->json(['error' => 'Tronadura no encontrada'], 404);
        }

        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => 'sometimes|integer|exists:frentes_trabajo,id',
            'fecha' => 'sometimes|date',
            'hora' => 'nullable|date_format:H:i',
            'jornada' => 'nullable|string|in:AM,PM,Madrugada,Noche',
            'toneladas_estimadas' => 'nullable|numeric|min:0',
            'dumpadas_estimadas' => 'nullable|integer|min:0',
            'estado' => 'sometimes|in:Activa,Completada,Cancelada',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $tronadura->update($request->only([
                'id_frente_trabajo',
                'fecha',
                'hora',
                'jornada',
                'toneladas_estimadas',
                'dumpadas_estimadas',
                'estado',
                'observaciones',
            ]));

            $tronadura->load('frenteTrabajo:id,codigo_completo');

            return response()->json([
                'mensaje' => 'Tronadura actualizada',
                'tronadura' => $tronadura
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar una tronadura
     * DELETE /api/dispatch/tronaduras/{id}
     */
    public function destroy($id)
    {
        $tronadura = Tronadura::find($id);

        if (!$tronadura) {
            return response()->json(['error' => 'Tronadura no encontrada'], 404);
        }

        // Desasociar dumpadas antes de eliminar
        Dumpada::where('tronadura_id', $id)->update(['tronadura_id' => null]);

        $tronadura->delete();

        return response()->json(['mensaje' => 'Tronadura eliminada']);
    }

    /**
     * Obtener tronaduras activas (para selector)
     * GET /api/dispatch/tronaduras/activas
     */
    public function activas(Request $request)
    {
        $query = Tronadura::where('estado', Tronadura::ESTADO_ACTIVA)
            ->with('frenteTrabajo:id,codigo_completo');

        if ($request->has('id_frente_trabajo')) {
            $query->where('id_frente_trabajo', $request->id_frente_trabajo);
        }

        $tronaduras = $query->orderBy('fecha', 'desc')->get();

        return response()->json($tronaduras);
    }

    /**
     * Asignar dumpadas a una tronadura
     * POST /api/dispatch/tronaduras/{id}/asignar-dumpadas
     */
    public function asignarDumpadas(Request $request, $id)
    {
        $tronadura = Tronadura::find($id);

        if (!$tronadura) {
            return response()->json(['error' => 'Tronadura no encontrada'], 404);
        }

        $validator = Validator::make($request->all(), [
            'dumpadas' => 'required|array|min:1',
            'dumpadas.*' => 'required|integer|exists:dumpadas,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            Dumpada::whereIn('id', $request->dumpadas)
                ->update(['tronadura_id' => $id]);

            // Recalcular totales
            $tronadura->recalcularTotales();
            $tronadura->load(['frenteTrabajo:id,codigo_completo', 'dumpadas']);

            return response()->json([
                'mensaje' => 'Dumpadas asignadas exitosamente',
                'tronadura' => $tronadura
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al asignar dumpadas',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Desasignar dumpadas de una tronadura
     * POST /api/dispatch/tronaduras/{id}/desasignar-dumpadas
     */
    public function desasignarDumpadas(Request $request, $id)
    {
        $tronadura = Tronadura::find($id);

        if (!$tronadura) {
            return response()->json(['error' => 'Tronadura no encontrada'], 404);
        }

        $validator = Validator::make($request->all(), [
            'dumpadas' => 'required|array|min:1',
            'dumpadas.*' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            Dumpada::whereIn('id', $request->dumpadas)
                ->where('tronadura_id', $id)
                ->update(['tronadura_id' => null]);

            // Recalcular totales
            $tronadura->recalcularTotales();

            return response()->json([
                'mensaje' => 'Dumpadas desasignadas',
                'tronadura' => $tronadura
            ]);

        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al desasignar',
                'mensaje' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Marcar tronadura como completada
     * POST /api/dispatch/tronaduras/{id}/completar
     */
    public function completar($id)
    {
        $tronadura = Tronadura::find($id);

        if (!$tronadura) {
            return response()->json(['error' => 'Tronadura no encontrada'], 404);
        }

        $tronadura->recalcularTotales();
        $tronadura->estado = Tronadura::ESTADO_COMPLETADA;
        $tronadura->save();

        return response()->json([
            'mensaje' => 'Tronadura marcada como completada',
            'tronadura' => $tronadura
        ]);
    }
}
