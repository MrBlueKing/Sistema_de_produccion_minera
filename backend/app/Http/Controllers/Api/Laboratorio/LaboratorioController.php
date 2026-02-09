<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class LaboratorioController extends Controller
{
    /**
     * Generar número de certificado automático
     * Formato: Año + número secuencial (ej: 2026-00001)
     */
    private function generarNumeroCertificado()
    {
        $year = date('Y');
        $prefijo = $year . '-';

        // Buscar el último certificado del año actual
        $ultimoCertificado = Dumpada::where('certificado', 'like', $prefijo . '%')
            ->whereNotNull('certificado')
            ->orderByRaw('CAST(SUBSTRING(certificado, 6) AS UNSIGNED) DESC')
            ->value('certificado');

        if ($ultimoCertificado) {
            // Extraer el número después del año
            $numero = (int) substr($ultimoCertificado, 5) + 1;
        } else {
            $numero = 1;
        }

        return $prefijo . str_pad($numero, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Listar dumpadas pendientes de análisis
     * Estados: Recibido (de muestreo), Ingresado, En Análisis
     * Con paginación y filtros
     */
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 15);
        $page = $request->get('page', 1);

        // Parámetros de filtros
        $search = $request->get('search');
        $jornada = $request->get('jornada');
        $fechaInicio = $request->get('fecha_inicio');
        $fechaFin = $request->get('fecha_fin');
        $idFrenteTrabajo = $request->get('id_frente_trabajo');
        $idFaena = $request->get('id_faena');

        // Estados pendientes de análisis (incluye Recibido de muestreo)
        $estadosPendientes = ['Recibido', 'Ingresado', 'En Análisis'];

        $query = Dumpada::with('frenteTrabajo.tipoFrente')
            ->whereIn('estado', $estadosPendientes)
            ->orderBy('fecha', 'desc')
            ->orderBy('id', 'desc');

        // Búsqueda general
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('acopios', 'like', '%' . $search . '%')
                    ->orWhere('certificado', 'like', '%' . $search . '%')
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

        // Filtro por faena (directo o a través del frente de trabajo)
        if ($idFaena) {
            $query->where(function ($q) use ($idFaena) {
                $q->where('id_faena', $idFaena)
                  ->orWhereHas('frenteTrabajo', function ($fq) use ($idFaena) {
                      $fq->where('id_faena', $idFaena);
                  });
            });
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
     * Completar análisis de una dumpada (agregar leyes)
     * Recibe: ley (Cu Total), cu_soluble
     * Calcula automáticamente: cu_insoluble (ley - cu_soluble), ley_cup (capping)
     * NOTA: El certificado se asigna al generar el PDF, NO aquí
     */
    public function completarAnalisis(Request $request, $id)
    {
        $dumpada = Dumpada::find($id);

        if (!$dumpada) {
            return response()->json([
                'success' => false,
                'message' => 'Dumpada no encontrada'
            ], 404);
        }

        // Validar que esté en estado pendiente
        if ($dumpada->estado === Dumpada::ESTADO_COMPLETADO) {
            return response()->json([
                'success' => false,
                'message' => 'Esta dumpada ya fue completada'
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'ley' => 'required|numeric|min:0',           // Cu Total
            'cu_soluble' => 'required|numeric|min:0',    // Cu Soluble
            'cu_insoluble' => 'nullable|numeric|min:0',  // Cu Insoluble (opcional, se calcula si no viene)
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Calcular Cu Insoluble si no viene (Cu Total - Cu Soluble)
        $cuInsoluble = $request->cu_insoluble ?? ($request->ley - $request->cu_soluble);

        // Determinar el rango automáticamente basado en la ley
        $rango = Dumpada::determinarRango($request->ley);

        // Calcular el capping automáticamente
        $leyCup = Dumpada::calcularCapping($request->ley, $dumpada->id_faena);

        // Actualizar la dumpada con los datos del laboratorio
        // NOTA: El certificado queda NULL hasta que se genere el PDF
        $dumpada->update([
            'ley' => $request->ley,
            'ley_cup' => $leyCup,
            'cu_soluble' => $request->cu_soluble,
            'cu_insoluble' => $cuInsoluble,
            'rango' => $rango,
            'estado' => Dumpada::ESTADO_COMPLETADO,
        ]);

        $dumpada->load('frenteTrabajo.tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Análisis completado exitosamente',
            'data' => $dumpada
        ], 200);
    }

    /**
     * Completar múltiples análisis en una sola petición
     * Recibe array de: ley (Cu Total), cu_soluble
     * Calcula automáticamente: cu_insoluble, ley_cup (capping)
     * NOTA: El certificado se asigna al generar el PDF, NO aquí
     */
    public function completarMultiplesAnalisis(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'analisis' => 'required|array|min:1',
            'analisis.*.id' => 'required|exists:dumpadas,id',
            'analisis.*.ley' => 'required|numeric|min:0',           // Cu Total
            'analisis.*.cu_soluble' => 'required|numeric|min:0',    // Cu Soluble
            'analisis.*.cu_insoluble' => 'nullable|numeric|min:0',  // Cu Insoluble (opcional)
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $completadas = [];
        $errores = [];

        foreach ($request->analisis as $analisis) {
            $dumpada = Dumpada::find($analisis['id']);

            if (!$dumpada) {
                $errores[] = "Dumpada ID {$analisis['id']} no encontrada";
                continue;
            }

            if ($dumpada->estado === Dumpada::ESTADO_COMPLETADO) {
                $errores[] = "Dumpada {$dumpada->acopios} ya está completada";
                continue;
            }

            // Calcular Cu Insoluble si no viene (Cu Total - Cu Soluble)
            $cuInsoluble = $analisis['cu_insoluble'] ?? ($analisis['ley'] - $analisis['cu_soluble']);

            // Determinar el rango automáticamente
            $rango = Dumpada::determinarRango($analisis['ley']);

            // Calcular el capping automáticamente
            $leyCup = Dumpada::calcularCapping($analisis['ley'], $dumpada->id_faena);

            // NOTA: El certificado queda NULL hasta que se genere el PDF
            $dumpada->update([
                'ley' => $analisis['ley'],
                'ley_cup' => $leyCup,
                'cu_soluble' => $analisis['cu_soluble'],
                'cu_insoluble' => $cuInsoluble,
                'rango' => $rango,
                'estado' => Dumpada::ESTADO_COMPLETADO,
            ]);

            $completadas[] = $dumpada->acopios ?: $dumpada->numero_dumpada;
        }

        return response()->json([
            'success' => true,
            'message' => count($completadas) . ' análisis completados',
            'completadas' => $completadas,
            'errores' => $errores,
        ], 200);
    }

    /**
     * Obtener estadísticas del laboratorio
     */
    public function estadisticas()
    {
        // Estados pendientes de análisis (incluye Recibido de muestreo)
        $estadosPendientes = ['Recibido', 'Ingresado', 'En Análisis'];

        $pendientes = Dumpada::whereIn('estado', $estadosPendientes)->count();
        $recibidas = Dumpada::where('estado', 'Recibido')->count();
        $completadas = Dumpada::where('estado', Dumpada::ESTADO_COMPLETADO)->count();
        $total = Dumpada::count();

        return response()->json([
            'success' => true,
            'data' => [
                'pendientes' => $pendientes,
                'recibidas' => $recibidas,  // Muestras recibidas de muestreo
                'completadas' => $completadas,
                'total' => $total,
                'porcentaje_completado' => $total > 0 ? round(($completadas / $total) * 100, 2) : 0,
            ]
        ], 200);
    }

    /**
     * Historial de análisis completados (con leyes)
     * Para generación de reportes/PDF
     */
    public function historial(Request $request)
    {
        $perPage = $request->get('per_page', 20);
        $page = $request->get('page', 1);

        // Parámetros de filtros
        $search = $request->get('search');
        $jornada = $request->get('jornada');
        $fechaInicio = $request->get('fecha_inicio');
        $fechaFin = $request->get('fecha_fin');
        $idFrenteTrabajo = $request->get('id_frente_trabajo');
        $idFaena = $request->get('id_faena');
        $rango = $request->get('rango');
        $estadoCertificado = $request->get('estado_certificado'); // 'con', 'sin', null (todos)
        $certificado = $request->get('certificado'); // búsqueda exacta por número

        $query = Dumpada::with('frenteTrabajo.tipoFrente')
            ->where('estado', Dumpada::ESTADO_COMPLETADO)
            ->whereNotNull('ley')
            ->orderBy('fecha', 'desc')
            ->orderBy('id', 'desc');

        // Búsqueda general
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('certificado', 'like', '%' . $search . '%')
                    ->orWhere('numero_dumpada', 'like', '%' . $search . '%')
                    ->orWhere('acopios', 'like', '%' . $search . '%')
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

        // Filtro por faena
        if ($idFaena) {
            $query->where(function ($q) use ($idFaena) {
                $q->where('id_faena', $idFaena)
                  ->orWhereHas('frenteTrabajo', function ($fq) use ($idFaena) {
                      $fq->where('id_faena', $idFaena);
                  });
            });
        }

        // Filtro por rango (Alta, Media, Baja, Estéril)
        if ($rango) {
            $query->where('rango', $rango);
        }

        // Filtro por estado de certificado (con/sin)
        if ($estadoCertificado === 'con') {
            $query->whereNotNull('certificado')->where('certificado', '!=', '');
        } elseif ($estadoCertificado === 'sin') {
            $query->where(function ($q) {
                $q->whereNull('certificado')->orWhere('certificado', '');
            });
        }

        // Filtro por número de certificado específico
        if ($certificado) {
            $query->where('certificado', 'like', '%' . $certificado . '%');
        }

        $dumpadas = $query->paginate($perPage, ['*'], 'page', $page);

        // Cargar datos de faenas
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
     * Cargar datos de faenas desde el sistema central y mapearlos a las dumpadas
     */
    private function cargarFaenasDesdeApiCentral($dumpadas, $token)
    {
        // Extraer IDs de faena únicos desde las dumpadas
        $idsFaena = collect($dumpadas)
            ->pluck('id_faena')
            ->filter()
            ->unique()
            ->values()
            ->toArray();

        // Si no hay IDs, intentar obtenerlos desde los frentes de trabajo
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
            } else {
                Log::warning('No se pudieron cargar faenas del sistema central', [
                    'status' => $response->status()
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error al cargar faenas del sistema central', [
                'message' => $e->getMessage()
            ]);
        }

        return $dumpadas;
    }
}
