<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\Dispatch\MuestraLibre;
use App\Traits\MultiTenancy;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class MuestraLibreController extends Controller
{
    use MultiTenancy;

    /**
     * Crear una nueva muestra libre y enviarla directamente al laboratorio
     * POST /api/dispatch/muestras-libres
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre'             => 'required|string|max:200',
            'solicitante'        => 'nullable|string|max:150',
            'id_frente_trabajo'  => 'nullable|exists:frentes_trabajo,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors(),
            ], 422);
        }

        // Determinar la faena: operador usa la suya, encargado usa la del frente o la propia
        $idFaena = $request->auth_faena;

        $muestra = MuestraLibre::create([
            'user_id'           => $request->auth_user_id,
            'id_faena'          => $idFaena,
            'id_frente_trabajo' => $request->id_frente_trabajo,
            'nombre'            => $request->nombre,
            'solicitante'       => $request->solicitante,
            'fecha'             => now()->format('Y-m-d'),
            'estado'            => MuestraLibre::ESTADO_INGRESADO,
        ]);

        $muestra->load('frenteTrabajo');

        return response()->json([
            'success' => true,
            'message' => 'Muestra libre enviada al laboratorio',
            'data'    => $muestra,
        ], 201);
    }

    /**
     * Historial completo de muestras libres con filtros y paginación
     * GET /api/dispatch/muestras-libres/historial
     */
    public function historial(Request $request)
    {
        $query = MuestraLibre::with('frenteTrabajo')
            ->orderBy('created_at', 'desc');

        if (!$this->esUsuarioGlobal($request)) {
            $query->where('id_faena', $request->auth_faena);
        } elseif ($request->id_faena) {
            $query->where('id_faena', $request->id_faena);
        }

        if ($request->estado) {
            $query->where('estado', $request->estado);
        }
        if ($request->fecha_inicio) {
            $query->whereDate('fecha', '>=', $request->fecha_inicio);
        }
        if ($request->fecha_fin) {
            $query->whereDate('fecha', '<=', $request->fecha_fin);
        }
        if ($request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nombre', 'like', "%{$search}%")
                  ->orWhere('solicitante', 'like', "%{$search}%");
            });
        }

        $muestras = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data'    => $muestras->items(),
            'meta'    => [
                'current_page' => $muestras->currentPage(),
                'last_page'    => $muestras->lastPage(),
                'total'        => $muestras->total(),
            ],
        ]);
    }

    /**
     * Listar muestras libres pendientes (para Registros Pendientes en Dispatch)
     * GET /api/dispatch/muestras-libres
     */
    public function index(Request $request)
    {
        $query = MuestraLibre::with('frenteTrabajo')
            ->where('estado', MuestraLibre::ESTADO_INGRESADO)
            ->orderBy('created_at', 'desc');

        if (!$this->esUsuarioGlobal($request)) {
            $query->where('id_faena', $request->auth_faena);
        }

        $muestras = $query->get();

        return response()->json([
            'success' => true,
            'data'    => $muestras,
        ]);
    }

    /**
     * Eliminar una muestra libre
     * DELETE /api/dispatch/muestras-libres/{id}
     */
    public function destroy(Request $request, $id)
    {
        $muestra = MuestraLibre::find($id);

        if (!$muestra) {
            return response()->json([
                'success' => false,
                'message' => 'Muestra no encontrada',
            ], 404);
        }

        $this->validarAccesoFaena($request, $muestra->id_faena);

        $muestra->delete();

        return response()->json([
            'success' => true,
            'message' => 'Muestra eliminada',
        ]);
    }

    /**
     * Editar análisis de una muestra libre ya completada
     * PUT /api/laboratorio/muestras-libres/{id}/editar
     */
    public function editarAnalisis(Request $request, $id)
    {
        $muestra = MuestraLibre::find($id);

        if (!$muestra) {
            return response()->json(['success' => false, 'message' => 'Muestra no encontrada'], 404);
        }

        $validator = Validator::make($request->all(), [
            'ley'          => 'required|numeric|min:0',
            'cu_soluble'   => 'required|numeric|min:0',
            'cu_insoluble' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $cuInsoluble = $request->cu_insoluble ?? ($request->ley - $request->cu_soluble);
        $leyCup      = Dumpada::calcularCapping($request->ley, $muestra->id_faena);
        $rango       = Dumpada::determinarRango($request->ley);

        $muestra->update([
            'ley'          => $request->ley,
            'ley_cup'      => $leyCup,
            'cu_soluble'   => $request->cu_soluble,
            'cu_insoluble' => $cuInsoluble,
            'rango'        => $rango,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Análisis actualizado exitosamente',
            'data'    => $muestra,
        ]);
    }

    /**
     * Completar análisis de una muestra libre
     * PUT /api/dispatch/muestras-libres/{id}/completar
     */
    public function completarAnalisis(Request $request, $id)
    {
        $muestra = MuestraLibre::find($id);

        if (!$muestra) {
            return response()->json(['success' => false, 'message' => 'Muestra no encontrada'], 404);
        }

        if ($muestra->estado === MuestraLibre::ESTADO_COMPLETADO) {
            return response()->json(['success' => false, 'message' => 'Esta muestra ya fue completada'], 422);
        }

        $validator = Validator::make($request->all(), [
            'ley'          => 'required|numeric|min:0',
            'cu_soluble'   => 'required|numeric|min:0',
            'cu_insoluble' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $cuInsoluble = $request->cu_insoluble ?? ($request->ley - $request->cu_soluble);
        $leyCup      = Dumpada::calcularCapping($request->ley, $muestra->id_faena);
        $rango       = Dumpada::determinarRango($request->ley);

        $muestra->update([
            'ley'          => $request->ley,
            'ley_cup'      => $leyCup,
            'cu_soluble'   => $request->cu_soluble,
            'cu_insoluble' => $cuInsoluble,
            'rango'        => $rango,
            'estado'       => MuestraLibre::ESTADO_COMPLETADO,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Análisis completado',
            'data'    => $muestra,
        ]);
    }
}
