<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\Dispatch\MuestraLibre;
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
     * Listar muestras pendientes de análisis (dumpadas + muestras libres)
     * Con paginación manual y campo 'tipo' para distinguirlas en frontend
     */
    public function index(Request $request)
    {
        $perPage     = (int) $request->get('per_page', 15);
        $page        = (int) $request->get('page', 1);
        $search      = $request->get('search');
        $jornada     = $request->get('jornada');
        $fechaInicio = $request->get('fecha_inicio');
        $fechaFin    = $request->get('fecha_fin');
        $idFrente    = $request->get('id_frente_trabajo');
        $idFaena     = $request->get('id_faena');

        // ── 1. DUMPADAS ────────────────────────────────────────────────────────
        $queryDumpadas = Dumpada::with('frenteTrabajo.tipoFrente')
            ->where(function ($q) {
                $q->where('estado', 'Recibido')
                  ->orWhere(function ($q2) {
                      $q2->where('estado', 'Ingresado')
                         ->where('para_muestreo', true);
                  });
            });

        if ($search) {
            $queryDumpadas->where(function ($q) use ($search) {
                $q->where('acopios', 'like', "%{$search}%")
                  ->orWhere('numero_dumpada', 'like', "%{$search}%")
                  ->orWhereHas('frenteTrabajo', fn($fq) => $fq->where('codigo_completo', 'like', "%{$search}%"));
            });
        }
        if ($jornada)     $queryDumpadas->where('jornada', $jornada);
        if ($fechaInicio) $queryDumpadas->whereDate('fecha', '>=', $fechaInicio);
        if ($fechaFin)    $queryDumpadas->whereDate('fecha', '<=', $fechaFin);
        if ($idFrente)    $queryDumpadas->where('id_frente_trabajo', $idFrente);
        if ($idFaena)     $queryDumpadas->where('id_faena', $idFaena);

        $dumpadas = $queryDumpadas->orderBy('fecha', 'desc')->orderBy('id', 'desc')->get()
            ->map(fn($d) => array_merge($d->toArray(), ['tipo' => 'dumpada']));

        // ── 2. MUESTRAS LIBRES ─────────────────────────────────────────────────
        $queryMuestras = MuestraLibre::with('frenteTrabajo')
            ->where('estado', MuestraLibre::ESTADO_INGRESADO);

        if ($search) {
            $queryMuestras->where(function ($q) use ($search) {
                $q->where('nombre', 'like', "%{$search}%")
                  ->orWhere('solicitante', 'like', "%{$search}%")
                  ->orWhereHas('frenteTrabajo', fn($fq) => $fq->where('codigo_completo', 'like', "%{$search}%"));
            });
        }
        if ($fechaInicio) $queryMuestras->whereDate('fecha', '>=', $fechaInicio);
        if ($fechaFin)    $queryMuestras->whereDate('fecha', '<=', $fechaFin);
        if ($idFrente)    $queryMuestras->where('id_frente_trabajo', $idFrente);
        if ($idFaena)     $queryMuestras->where('id_faena', $idFaena);

        $muestras = $queryMuestras->orderBy('created_at', 'desc')->get()
            ->map(fn($m) => array_merge($m->toArray(), ['tipo' => 'muestra_libre']));

        // ── 3. MERGE + PAGINACIÓN MANUAL ───────────────────────────────────────
        $todos = $dumpadas->concat($muestras)
            ->sortByDesc('created_at')
            ->values();

        $total      = $todos->count();
        $lastPage   = max(1, (int) ceil($total / $perPage));
        $offset     = ($page - 1) * $perPage;
        $items      = $todos->slice($offset, $perPage)->values();

        // Enriquecer dumpadas con datos de faena (API central)
        $dumpadasItems = $items->filter(fn($i) => $i['tipo'] === 'dumpada')->all();
        // Reconstruir como objetos para el helper (trabaja con colecciones Eloquent-like)
        $dumpadasObj = Dumpada::hydrate(array_values($dumpadasItems));
        $dumpadasConFaenas = collect($this->cargarFaenasDesdeApiCentral($dumpadasObj->all(), $request->bearerToken()))
            ->keyBy('id');

        $itemsFinales = $items->map(function ($item) use ($dumpadasConFaenas) {
            if ($item['tipo'] === 'dumpada' && isset($dumpadasConFaenas[$item['id']])) {
                $obj = $dumpadasConFaenas[$item['id']];
                $item['faena_info'] = $obj->faena_info ?? null;
            }
            return $item;
        })->values();

        return response()->json([
            'success' => true,
            'data'    => $itemsFinales,
            'pagination' => [
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => $lastPage,
                'from'         => $total > 0 ? $offset + 1 : null,
                'to'           => $total > 0 ? min($offset + $perPage, $total) : null,
            ],
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
     * Editar análisis de una dumpada ya completada
     * PUT /api/laboratorio/historial/{id}
     */
    public function editarAnalisis(Request $request, $id)
    {
        $dumpada = Dumpada::find($id);

        if (!$dumpada) {
            return response()->json([
                'success' => false,
                'message' => 'Dumpada no encontrada'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'ley' => 'required|numeric|min:0',
            'cu_soluble' => 'required|numeric|min:0',
            'cu_insoluble' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $cuInsoluble = $request->cu_insoluble ?? ($request->ley - $request->cu_soluble);
        $rango = Dumpada::determinarRango($request->ley);
        $leyCup = Dumpada::calcularCapping($request->ley, $dumpada->id_faena);

        $dumpada->update([
            'ley' => $request->ley,
            'ley_cup' => $leyCup,
            'cu_soluble' => $request->cu_soluble,
            'cu_insoluble' => $cuInsoluble,
            'rango' => $rango,
        ]);

        $dumpada->load('frenteTrabajo.tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Análisis actualizado exitosamente',
            'data' => $dumpada
        ], 200);
    }

    /**
     * Obtener estadísticas del laboratorio
     */
    public function estadisticas()
    {
        // Pendientes = dumpadas Recibido + dumpadas Ingresado+para_muestreo + muestras libres Ingresado
        $pendientesDumpadas = Dumpada::where(function ($q) {
            $q->where('estado', 'Recibido')
              ->orWhere(function ($q2) {
                  $q2->where('estado', 'Ingresado')->where('para_muestreo', true);
              });
        })->count();

        $pendientesMuestras = MuestraLibre::where('estado', MuestraLibre::ESTADO_INGRESADO)->count();

        $pendientes = $pendientesDumpadas + $pendientesMuestras;
        $recibidas  = Dumpada::where('estado', 'Recibido')->count();
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
     * Historial de análisis completados (dumpadas + muestras libres)
     * Para generación de reportes/PDF
     */
    public function historial(Request $request)
    {
        $perPage     = (int) $request->get('per_page', 20);
        $page        = (int) $request->get('page', 1);
        $search      = $request->get('search');
        $jornada     = $request->get('jornada');
        $fechaInicio = $request->get('fecha_inicio');
        $fechaFin    = $request->get('fecha_fin');
        $idFrente    = $request->get('id_frente_trabajo');
        $idFaena     = $request->get('id_faena');
        $estadoCertificado = $request->get('estado_certificado');
        $certificado       = $request->get('certificado');

        // ── 1. DUMPADAS COMPLETADAS ────────────────────────────────────────
        $queryDumpadas = Dumpada::with('frenteTrabajo.tipoFrente')
            ->where('estado', Dumpada::ESTADO_COMPLETADO)
            ->whereNotNull('ley');

        if ($search) {
            $queryDumpadas->where(function ($q) use ($search) {
                $q->where('certificado', 'like', "%{$search}%")
                  ->orWhere('numero_dumpada', 'like', "%{$search}%")
                  ->orWhere('acopios', 'like', "%{$search}%")
                  ->orWhereHas('frenteTrabajo', fn($fq) => $fq->where('codigo_completo', 'like', "%{$search}%"));
            });
        }
        if ($jornada)     $queryDumpadas->where('jornada', $jornada);
        if ($fechaInicio) $queryDumpadas->whereDate('fecha', '>=', $fechaInicio);
        if ($fechaFin)    $queryDumpadas->whereDate('fecha', '<=', $fechaFin);
        if ($idFrente)    $queryDumpadas->where('id_frente_trabajo', $idFrente);
        if ($idFaena)     $queryDumpadas->where(function ($q) use ($idFaena) {
            $q->where('id_faena', $idFaena)
              ->orWhereHas('frenteTrabajo', fn($fq) => $fq->where('id_faena', $idFaena));
        });
        if ($estadoCertificado === 'con') {
            $queryDumpadas->whereNotNull('certificado')->where('certificado', '!=', '');
        } elseif ($estadoCertificado === 'sin') {
            $queryDumpadas->where(fn($q) => $q->whereNull('certificado')->orWhere('certificado', ''));
        }
        if ($certificado) $queryDumpadas->where('certificado', 'like', "%{$certificado}%");

        $dumpadas = $queryDumpadas->orderBy('fecha', 'desc')->orderBy('id', 'desc')->get()
            ->map(fn($d) => array_merge($d->toArray(), ['tipo' => 'dumpada']));

        // ── 2. MUESTRAS LIBRES COMPLETADAS ────────────────────────────────
        // Solo si no se filtra por jornada, certificado o estado_certificado
        // (esos filtros no aplican a muestras libres)
        $incluirMuestras = !$jornada && !$certificado && !$estadoCertificado;

        $muestras = collect();
        if ($incluirMuestras) {
            $queryMuestras = MuestraLibre::with('frenteTrabajo')
                ->where('estado', MuestraLibre::ESTADO_COMPLETADO)
                ->whereNotNull('ley');

            if ($search) {
                $queryMuestras->where(function ($q) use ($search) {
                    $q->where('nombre', 'like', "%{$search}%")
                      ->orWhere('solicitante', 'like', "%{$search}%")
                      ->orWhereHas('frenteTrabajo', fn($fq) => $fq->where('codigo_completo', 'like', "%{$search}%"));
                });
            }
            if ($fechaInicio) $queryMuestras->whereDate('fecha', '>=', $fechaInicio);
            if ($fechaFin)    $queryMuestras->whereDate('fecha', '<=', $fechaFin);
            if ($idFrente)    $queryMuestras->where('id_frente_trabajo', $idFrente);
            if ($idFaena)     $queryMuestras->where('id_faena', $idFaena);

            $muestras = $queryMuestras->orderBy('created_at', 'desc')->get()
                ->map(fn($m) => array_merge($m->toArray(), ['tipo' => 'muestra_libre']));
        }

        // ── 3. MERGE + PAGINACIÓN MANUAL ──────────────────────────────────
        // Usar strtotime para parsear fechas correctamente sin importar el formato de serialización
        $todos    = $dumpadas->concat($muestras)
            ->sortByDesc(function ($item) {
                $ts = strtotime($item['fecha'] ?? $item['created_at'] ?? '1970-01-01');
                return $ts * 1000000 + ($item['id'] ?? 0); // Tiebreaker por ID
            })
            ->values();
        $total    = $todos->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $offset   = ($page - 1) * $perPage;
        $items    = $todos->slice($offset, $perPage)->values();

        // Enriquecer dumpadas con faenas desde API central
        $dumpadasItems = $items->filter(fn($i) => $i['tipo'] === 'dumpada')->all();
        $dumpadasObj   = Dumpada::hydrate(array_values($dumpadasItems));
        $dumpadasConFaenas = collect($this->cargarFaenasDesdeApiCentral($dumpadasObj->all(), $request->bearerToken()))
            ->keyBy('id');

        $itemsFinales = $items->map(function ($item) use ($dumpadasConFaenas) {
            if ($item['tipo'] === 'dumpada' && isset($dumpadasConFaenas[$item['id']])) {
                $obj = $dumpadasConFaenas[$item['id']];
                $item['faena_info'] = $obj->faena_info ?? null;
            }
            return $item;
        })->values();

        return response()->json([
            'success' => true,
            'data'    => $itemsFinales,
            'pagination' => [
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => $lastPage,
                'from'         => $total > 0 ? $offset + 1 : null,
                'to'           => $total > 0 ? min($offset + $perPage, $total) : null,
            ],
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
                ->get(config('services.sistema_central_api') . '/faenas');

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
