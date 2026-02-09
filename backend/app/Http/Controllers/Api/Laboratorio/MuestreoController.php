<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class MuestreoController extends Controller
{
    // Estados válidos para muestreo (simplificados)
    const ESTADO_INGRESADO = 'Ingresado';  // Estado inicial - Por Recibir
    const ESTADO_RECIBIDO = 'Recibido';    // Muestra recibida en laboratorio

    /**
     * Listar dumpadas pendientes de muestreo (sin leyes ingresadas)
     * Ordenadas por fecha (las del día actual primero) y agrupadas por frente de trabajo
     */
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $page = $request->get('page', 1);

        // Parámetros de filtros
        $search = $request->get('search');
        $jornada = $request->get('jornada');
        $fechaInicio = $request->get('fecha_inicio');
        $fechaFin = $request->get('fecha_fin');
        $idFrenteTrabajo = $request->get('id_frente_trabajo');
        $estado = $request->get('estado');

        // Dumpadas SIN LEY = pendientes de muestreo/análisis
        $query = Dumpada::with('frenteTrabajo.tipoFrente')
            ->whereNull('ley') // Sin ley ingresada
            ->orderByRaw("CASE WHEN DATE(fecha) = CURDATE() THEN 0 ELSE 1 END") // Hoy primero
            ->orderBy('fecha', 'desc') // Más recientes primero
            ->orderBy('id_frente_trabajo', 'asc') // Agrupar por frente
            ->orderBy('id', 'desc');

        // Búsqueda general
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('acopios', 'like', '%' . $search . '%')
                    ->orWhere('numero_dumpada', 'like', '%' . $search . '%')
                    ->orWhereHas('frenteTrabajo', function ($fq) use ($search) {
                        $fq->where('codigo_completo', 'like', '%' . $search . '%');
                    });
            });
        }

        // Filtro por jornada
        if ($jornada) {
            $query->where('jornada', $jornada);
        }

        // Filtro por rango de fechas
        if ($fechaInicio) {
            $query->whereDate('fecha', '>=', $fechaInicio);
        }
        if ($fechaFin) {
            $query->whereDate('fecha', '<=', $fechaFin);
        }

        // Filtro por frente de trabajo
        if ($idFrenteTrabajo) {
            $query->where('id_frente_trabajo', $idFrenteTrabajo);
        }

        // Filtro por estado de muestreo
        if ($estado) {
            $query->where('estado', $estado);
        }

        $dumpadas = $query->paginate($perPage, ['*'], 'page', $page);

        // Cargar datos de faenas desde el sistema central
        $dumpadasConFaenas = $this->cargarFaenasDesdeApiCentral($dumpadas->items(), $request->bearerToken());

        return response()->json([
            'success' => true,
            'data' => $dumpadasConFaenas,
            'pagination' => [
                'total' => $dumpadas->total(),
                'per_page' => $dumpadas->perPage(),
                'current_page' => $dumpadas->currentPage(),
                'last_page' => $dumpadas->lastPage(),
                'from' => $dumpadas->firstItem(),
                'to' => $dumpadas->lastItem()
            ]
        ], 200);
    }

    /**
     * Actualizar estado de muestreo de una dumpada
     */
    public function actualizarEstado(Request $request, $id)
    {
        $dumpada = Dumpada::find($id);

        if (!$dumpada) {
            return response()->json([
                'success' => false,
                'message' => 'Dumpada no encontrada'
            ], 404);
        }

        // Validar que tenga ley null (aún pendiente de análisis)
        if ($dumpada->ley !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Esta dumpada ya tiene leyes registradas'
            ], 422);
        }

        $estadosValidos = [
            self::ESTADO_INGRESADO,  // Por Recibir
            self::ESTADO_RECIBIDO,   // Recibido en laboratorio
        ];

        $validator = Validator::make($request->all(), [
            'estado' => 'required|string|in:' . implode(',', $estadosValidos),
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $dumpada->update([
            'estado' => $request->estado
        ]);

        $dumpada->load('frenteTrabajo.tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Estado actualizado correctamente',
            'data' => $dumpada
        ], 200);
    }

    /**
     * Actualizar estado de múltiples dumpadas
     */
    public function actualizarEstadoMultiple(Request $request)
    {
        $estadosValidos = [
            self::ESTADO_INGRESADO,  // Por Recibir
            self::ESTADO_RECIBIDO,   // Recibido en laboratorio
        ];

        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|exists:dumpadas,id',
            'estado' => 'required|string|in:' . implode(',', $estadosValidos),
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $actualizadas = 0;
        $errores = [];

        foreach ($request->ids as $id) {
            $dumpada = Dumpada::find($id);

            if (!$dumpada) {
                $errores[] = "Dumpada ID {$id} no encontrada";
                continue;
            }

            if ($dumpada->ley !== null) {
                $errores[] = "Dumpada {$dumpada->numero_dumpada} ya tiene leyes registradas";
                continue;
            }

            $dumpada->update(['estado' => $request->estado]);
            $actualizadas++;
        }

        return response()->json([
            'success' => true,
            'message' => "{$actualizadas} dumpada(s) actualizada(s)",
            'actualizadas' => $actualizadas,
            'errores' => $errores,
        ], 200);
    }

    /**
     * Obtener estadísticas de muestreo
     */
    public function estadisticas()
    {
        $hoy = Carbon::today()->toDateString();

        // Total sin ley (pendientes de análisis)
        $totalSinLey = Dumpada::whereNull('ley')->count();

        // Del día de hoy
        $hoyCount = Dumpada::whereNull('ley')
            ->whereDate('fecha', $hoy)
            ->count();

        // Por Recibir (estado Ingresado)
        $ingresadas = Dumpada::whereNull('ley')
            ->where('estado', self::ESTADO_INGRESADO)
            ->count();

        // Recibidas en laboratorio
        $recibidas = Dumpada::whereNull('ley')
            ->where('estado', self::ESTADO_RECIBIDO)
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'total_sin_ley' => $totalSinLey,
                'hoy' => $hoyCount,
                'ingresadas' => $ingresadas,  // Por Recibir
                'recibidas' => $recibidas,    // Ya recibidas
            ]
        ], 200);
    }

    /**
     * Cargar datos de faenas desde el sistema central
     */
    private function cargarFaenasDesdeApiCentral($dumpadas, $token)
    {
        $idsFaena = collect($dumpadas)
            ->pluck('id_faena')
            ->filter()
            ->unique()
            ->values()
            ->toArray();

        if (empty($idsFaena)) {
            $idsFaena = collect($dumpadas)
                ->pluck('frenteTrabajo.id_faena')
                ->filter()
                ->unique()
                ->values()
                ->toArray();
        }

        if (empty($idsFaena)) {
            return $dumpadas;
        }

        try {
            $response = Http::withToken($token)
                ->get(env('SISTEMA_CENTRAL_API') . '/faenas');

            if ($response->successful()) {
                $todasLasFaenas = $response->json('data', []);
                $faenasMap = collect($todasLasFaenas)->keyBy('id');

                foreach ($dumpadas as $dumpada) {
                    $idFaena = $dumpada->id_faena ?? $dumpada->frenteTrabajo?->id_faena;

                    if ($idFaena && isset($faenasMap[$idFaena])) {
                        $dumpada->faena_info = $faenasMap[$idFaena];
                    } else {
                        $dumpada->faena_info = null;
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Error al cargar faenas del sistema central', [
                'message' => $e->getMessage()
            ]);
        }

        return $dumpadas;
    }
}
