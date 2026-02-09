<?php

namespace App\Http\Controllers\Api\Dispatch;

use App\Http\Controllers\Controller;
use App\Models\Dispatch\Dumpada;
use App\Models\Ingenieria\FrenteTrabajo;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DumpadaController extends Controller
{
    use MultiTenancy;
    /**
     * Convertir fecha de formato DD-MM-YYYY a Y-m-d
     */
    private function convertirFecha($fecha)
    {
        if (!$fecha) {
            return null;
        }

        // Si la fecha viene en formato DD-MM-YYYY
        if (preg_match('/^\d{2}-\d{2}-\d{4}$/', $fecha)) {
            return Carbon::createFromFormat('d-m-Y', $fecha)->format('Y-m-d');
        }

        // Si ya viene en formato Y-m-d o es una fecha válida
        return $fecha;
    }

    /**
     * Listar todas las dumpadas con paginación y filtros mejorados
     */
    public function index(Request $request)
    {
        $perPage = $request->get('per_page', 15);
        $page = $request->get('page', 1);

        // Parámetros de filtros
        $search = $request->get('search');
        $estado = $request->get('estado');
        $jornada = $request->get('jornada');
        $fechaInicio = $request->get('fecha_inicio');
        $fechaFin = $request->get('fecha_fin');
        $idFrenteTrabajo = $request->get('id_frente_trabajo');
        $idFaena = $request->get('id_faena');

        $query = Dumpada::with(['frenteTrabajo.tipoFrente'])
            ->orderBy('id', 'desc'); // Ordenar por ID descendente (los más recientes primero)

        // ✅ MULTI-FAENA: Respeta roles de usuario
        Log::info('🔍 [DUMPADAS] Filtro de faena', [
            'es_usuario_global' => $this->esUsuarioGlobal($request),
            'auth_faena' => $request->auth_faena,
            'id_faena_param' => $idFaena,
            'roles' => $request->auth_roles ?? []
        ]);

        if (!$this->esUsuarioGlobal($request)) {
            // OPERADOR DISPATCH: Solo su faena
            $query->where('id_faena', $request->auth_faena);
            Log::info('🔒 [DUMPADAS] Filtrando por faena de operador', ['id_faena' => $request->auth_faena]);
        } else {
            // ENCARGADO DISPATCH: Permite filtrar por múltiples faenas
            if ($idFaena) {
                // Si contiene comas, es una lista de faenas
                if (strpos($idFaena, ',') !== false) {
                    $faenasArray = array_map('trim', explode(',', $idFaena));
                    $query->whereIn('id_faena', $faenasArray);
                    Log::info('🌐 [DUMPADAS] Filtrando por múltiples faenas', ['faenas' => $faenasArray]);
                } else {
                    // Una sola faena
                    $query->where('id_faena', $idFaena);
                    Log::info('🌐 [DUMPADAS] Filtrando por faena única', ['id_faena' => $idFaena]);
                }
            } else {
                Log::info('🌐 [DUMPADAS] Sin filtro de faena - mostrando TODAS');
            }
            // Si no viene id_faena y es global: muestra TODAS las faenas
        }

        // Búsqueda general (busca en código de acopios, certificado, número de dumpada, certificado PDF)
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('acopios', 'like', '%' . $search . '%')
                    ->orWhere('certificado', 'like', '%' . $search . '%')
                    ->orWhere('numero_dumpada', 'like', '%' . $search . '%')
                    ->orWhere('numero_certificado_pdf', 'like', '%' . $search . '%')
                    ->orWhereHas('frenteTrabajo', function ($fq) use ($search) {
                        $fq->where('codigo_completo', 'like', '%' . $search . '%');
                    });
            });
        }

        // Filtro por estado
        if ($estado) {
            $query->where('estado', $estado);
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

        $dumpadas = $query->paginate($perPage, ['*'], 'page', $page);

        Log::info('📊 [DUMPADAS] Resultados obtenidos', [
            'total' => $dumpadas->total(),
            'pagina_actual' => $dumpadas->currentPage(),
            'registros_en_pagina' => $dumpadas->count()
        ]);

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
     * Crear una nueva dumpada
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
            'jornada' => 'required|in:AM,PM,Madrugada,Noche',
            'fecha' => 'nullable|date',
            'ton' => 'nullable|numeric|min:0',
            'ley' => 'nullable|numeric|min:0',
            'ley_cup' => 'nullable|numeric|min:0',
            'certificado' => 'nullable|string|max:100',
            'ley_visual' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Obtener el frente de trabajo
        $frente = FrenteTrabajo::find($request->id_frente_trabajo);

        // MULTI-FAENA: Validar acceso a la faena del frente
        $this->validarAccesoFaena($request, $frente->id_faena);

        // Generar número de dumpada automáticamente (consecutivo único)
        $numeroDumpada = Dumpada::generarNumeroDumpada();

        // Usar la fecha proporcionada o la fecha actual, convertida al formato correcto
        $fecha = $this->convertirFecha($request->fecha) ?? now()->format('Y-m-d');

        // Generar número de jornada (secuencial por frente+jornada+fecha)
        $numeroJornada = Dumpada::generarNumeroJornada(
            $request->id_frente_trabajo,
            $request->jornada,
            $fecha
        );

        // El campo 'acopios' se deja NULL por ahora
        // Se asignará cuando la dumpada se agregue a un acopio
        $acopios = null;

        // Determinar el rango automáticamente basado en la ley
        $rango = $request->ley ? Dumpada::determinarRango($request->ley) : null;

        // Determinar el estado basado en si tiene los datos del laboratorio
        // Solo hay 2 estados: "Ingresado" (sin datos) o "Completado" (con todos los datos)
        $estado = Dumpada::ESTADO_INGRESADO; // Estado inicial: muestra enviada al laboratorio

        // Si tiene los 3 datos del laboratorio, está completado
        if ($request->ley && $request->ley_cup && $request->certificado) {
            $estado = Dumpada::ESTADO_COMPLETADO;
        }

        // Obtener el nombre de la faena desde el sistema central
        $nombreFaena = $this->obtenerNombreFaena($frente->id_faena, $request->bearerToken());

        // Crear la dumpada con los datos generados
        $data = [
            'id_frente_trabajo' => $request->id_frente_trabajo,
            'jornada' => $request->jornada,
            'numero_jornada' => $numeroJornada,
            'ley_visual' => $request->ley_visual,
            'ton' => $request->ton,
            'ley' => $request->ley,
            'ley_cup' => $request->ley_cup,
            'certificado' => $request->certificado,
            'numero_dumpada' => $numeroDumpada,
            'acopios' => $acopios,
            'fecha' => $fecha,
            'rango' => $rango,
            'estado' => $estado,
            'user_id' => $request->auth_user_id,
            'id_faena' => $frente->id_faena, // ID numérico de la faena
            'faena' => $nombreFaena, // Nombre de la faena
        ];

        $dumpada = Dumpada::create($data);
        $dumpada->load('frenteTrabajo.tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Dumpada creada exitosamente',
            'data' => $dumpada
        ], 201);
    }

    /**
     * Crear múltiples dumpadas en una sola transacción (BULK)
     */
    public function bulkStore(Request $request)
    {
        // Validar que venga un array de dumpadas
        $validator = Validator::make($request->all(), [
            'dumpadas' => 'required|array|min:1|max:100',
            'dumpadas.*.id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
            'dumpadas.*.jornada' => 'required|in:AM,PM,Madrugada,Noche',
            'dumpadas.*.fecha' => 'nullable|date',
            'dumpadas.*.ton' => 'nullable|numeric|min:0',
            'dumpadas.*.ley' => 'nullable|numeric|min:0',
            'dumpadas.*.ley_cup' => 'nullable|numeric|min:0',
            'dumpadas.*.certificado' => 'nullable|string|max:100',
            'dumpadas.*.ley_visual' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $dumpadasCreadas = [];

        try {
            // MULTI-FAENA: Validar acceso a todos los frentes antes de crear
            $frentesIds = collect($request->dumpadas)->pluck('id_frente_trabajo')->unique();
            $frentes = FrenteTrabajo::whereIn('id', $frentesIds)->get();

            foreach ($frentes as $frente) {
                $this->validarAccesoFaena($request, $frente->id_faena);
            }

            // Usar transacción de BD: todo o nada
            DB::beginTransaction();

            foreach ($request->dumpadas as $dumpadaData) {
                // Obtener el frente de trabajo
                $frente = FrenteTrabajo::find($dumpadaData['id_frente_trabajo']);

                // Generar número de dumpada automáticamente (consecutivo único)
                $numeroDumpada = Dumpada::generarNumeroDumpada();

                // Usar la fecha proporcionada o la fecha actual
                $fecha = isset($dumpadaData['fecha'])
                    ? $this->convertirFecha($dumpadaData['fecha'])
                    : now()->format('Y-m-d');

                // Generar número de jornada (secuencial por frente+jornada+fecha)
                $numeroJornada = Dumpada::generarNumeroJornada(
                    $dumpadaData['id_frente_trabajo'],
                    $dumpadaData['jornada'],
                    $fecha
                );

                // El campo 'acopios' se deja NULL por ahora
                $acopios = null;

                // Determinar el rango automáticamente basado en la ley
                $rango = isset($dumpadaData['ley'])
                    ? Dumpada::determinarRango($dumpadaData['ley'])
                    : null;

                // Determinar el estado
                $estado = Dumpada::ESTADO_INGRESADO;

                if (isset($dumpadaData['ley']) && isset($dumpadaData['ley_cup']) && isset($dumpadaData['certificado'])) {
                    $estado = Dumpada::ESTADO_COMPLETADO;
                }

                // Obtener el nombre de la faena
                $nombreFaena = $this->obtenerNombreFaena($frente->id_faena, $request->bearerToken());

                // Crear la dumpada
                $data = [
                    'id_frente_trabajo' => $dumpadaData['id_frente_trabajo'],
                    'jornada' => $dumpadaData['jornada'],
                    'numero_jornada' => $numeroJornada,
                    'ley_visual' => $dumpadaData['ley_visual'] ?? null,
                    'ton' => $dumpadaData['ton'] ?? null,
                    'ley' => $dumpadaData['ley'] ?? null,
                    'ley_cup' => $dumpadaData['ley_cup'] ?? null,
                    'certificado' => $dumpadaData['certificado'] ?? null,
                    'numero_dumpada' => $numeroDumpada,
                    'acopios' => $acopios,
                    'fecha' => $fecha,
                    'rango' => $rango,
                    'estado' => $estado,
                    'user_id' => $request->auth_user_id,
                    'id_faena' => $frente->id_faena,
                    'faena' => $nombreFaena,
                ];

                $dumpada = Dumpada::create($data);
                $dumpada->load('frenteTrabajo.tipoFrente');

                $dumpadasCreadas[] = $dumpada;
            }

            // Confirmar transacción
            DB::commit();

            return response()->json([
                'success' => true,
                'message' => count($dumpadasCreadas) . ' dumpada(s) creadas exitosamente',
                'data' => $dumpadasCreadas
            ], 201);

        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            // Revertir transacción
            DB::rollBack();

            // Propagar excepciones HTTP (403, 404, etc.) con su código correcto
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'error' => $e->getMessage()
            ], $e->getStatusCode());

        } catch (\Exception $e) {
            // Revertir transacción en caso de error
            DB::rollBack();

            Log::error('Error en creación masiva de dumpadas', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al crear dumpadas en bloque',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mostrar una dumpada específica
     */
    public function show($id)
    {
        $dumpada = Dumpada::with('frenteTrabajo.tipoFrente')->find($id);

        if (!$dumpada) {
            return response()->json([
                'success' => false,
                'message' => 'Dumpada no encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $dumpada
        ], 200);
    }

    /**
     * Actualizar una dumpada
     */
    public function update(Request $request, $id)
    {
        $dumpada = Dumpada::find($id);

        if (!$dumpada) {
            return response()->json([
                'success' => false,
                'message' => 'Dumpada no encontrada'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
            'jornada' => 'required|in:AM,PM,Madrugada,Noche',
            'fecha' => 'nullable|date',
            'ton' => 'nullable|numeric|min:0',
            'ley' => 'nullable|numeric|min:0',
            'ley_cup' => 'nullable|numeric|min:0',
            'certificado' => 'nullable|string|max:100',
            'ley_visual' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Obtener el frente de trabajo
        $frente = FrenteTrabajo::find($request->id_frente_trabajo);

        // Regenerar numero_jornada si cambiaron datos relevantes (frente, jornada o fecha)
        $fecha = $this->convertirFecha($request->fecha) ?? $dumpada->fecha;
        $numeroJornada = $dumpada->numero_jornada;

        if ($request->id_frente_trabajo != $dumpada->id_frente_trabajo ||
            $request->jornada != $dumpada->jornada ||
            $this->convertirFecha($request->fecha) != $dumpada->getRawOriginal('fecha')) {

            // Regenerar el número de jornada para la nueva combinación
            $numeroJornada = Dumpada::generarNumeroJornada(
                $request->id_frente_trabajo,
                $request->jornada,
                $fecha
            );
        }

        // El campo acopios se mantiene (se usa para el código del acopio asignado)
        $acopios = $dumpada->acopios;

        // Determinar el rango automáticamente si cambió la ley
        $rango = $request->ley ? Dumpada::determinarRango($request->ley) : $dumpada->rango;

        // Actualizar estado basado en los datos proporcionados
        // Solo hay 2 estados: "Ingresado" (sin datos) o "Completado" (con todos los datos)
        $ley = $request->ley ?? $dumpada->ley;
        $leyCup = $request->ley_cup ?? $dumpada->ley_cup;
        $certificado = $request->certificado ?? $dumpada->certificado;

        if ($ley && $leyCup && $certificado) {
            $estado = Dumpada::ESTADO_COMPLETADO;
        } else {
            $estado = Dumpada::ESTADO_INGRESADO;
        }

        // Actualizar la dumpada
        $data = [
            'id_frente_trabajo' => $request->id_frente_trabajo,
            'jornada' => $request->jornada,
            'numero_jornada' => $numeroJornada,
            'fecha' => $fecha,
            'ton' => $request->ton ?? $dumpada->ton,
            'ley' => $request->ley ?? $dumpada->ley,
            'ley_cup' => $request->ley_cup ?? $dumpada->ley_cup,
            'certificado' => $request->certificado ?? $dumpada->certificado,
            'ley_visual' => $request->ley_visual ?? $dumpada->ley_visual,
            'acopios' => $acopios,
            'rango' => $rango,
            'estado' => $estado,
        ];

        $dumpada->update($data);
        $dumpada->load('frenteTrabajo.tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Dumpada actualizada exitosamente',
            'data' => $dumpada
        ], 200);
    }

    /**
     * Eliminar una dumpada
     */
    public function destroy($id)
    {
        $dumpada = Dumpada::find($id);

        if (!$dumpada) {
            return response()->json([
                'success' => false,
                'message' => 'Dumpada no encontrada'
            ], 404);
        }

        $dumpada->delete();

        return response()->json([
            'success' => true,
            'message' => 'Dumpada eliminada exitosamente'
        ], 200);
    }

    /**
     * Previsualizar próximo número de dumpada y código completo
     * Formato del código: "{codigo_frente} {fecha} {jornada} {numero_jornada}"
     * Ejemplo: "M3 -11N 29.09.2025 PM 1"
     */
    public function previsualizarAcopio(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
            'jornada' => 'required|in:AM,PM,Madrugada,Noche',
            'fecha' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Obtener el frente de trabajo
        $frente = FrenteTrabajo::find($request->id_frente_trabajo);

        // Generar número de dumpada automáticamente (consecutivo único global)
        $numeroDumpada = Dumpada::generarNumeroDumpada();

        // Usar la fecha proporcionada o la fecha actual, convertida al formato correcto
        $fecha = $this->convertirFecha($request->fecha) ?? now()->format('Y-m-d');

        // Generar número de jornada (secuencial por frente+jornada+fecha)
        $numeroJornada = Dumpada::generarNumeroJornada(
            $request->id_frente_trabajo,
            $request->jornada,
            $fecha
        );

        // Generar código completo de la dumpada
        // Formato: "{codigo_frente} {fecha} {jornada} {numero_jornada}"
        $fechaFormateada = Carbon::parse($fecha)->format('d.m.Y');
        $codigoCompleto = trim("{$frente->codigo_completo} {$fechaFormateada} {$request->jornada} {$numeroJornada}");

        return response()->json([
            'success' => true,
            'data' => [
                'numero_dumpada' => $numeroDumpada,
                'numero_jornada' => $numeroJornada,
                'codigo_completo' => $codigoCompleto,
                'codigo_frente' => $frente->codigo_completo,
                'jornada' => $request->jornada,
                'fecha' => $fecha
            ]
        ], 200);
    }

    /**
     * Cargar datos de faenas desde el sistema central y mapearlos a las dumpadas
     */
    private function cargarFaenasDesdeApiCentral($dumpadas, $token)
    {
        // Extraer IDs de faena únicos desde las dumpadas directamente (excluyendo nulls)
        $idsFaena = collect($dumpadas)
            ->pluck('id_faena')
            ->filter()
            ->unique()
            ->values()
            ->toArray();

        // Si no hay IDs de faena, intentar obtenerlos desde los frentes de trabajo (para compatibilidad con datos viejos)
        if (empty($idsFaena)) {
            $idsFaena = collect($dumpadas)
                ->pluck('frenteTrabajo.id_faena')
                ->filter()
                ->unique()
                ->values()
                ->toArray();
        }

        // Si aún no hay IDs de faena, retornar dumpadas sin modificar
        if (empty($idsFaena)) {
            return $dumpadas;
        }

        try {
            // Hacer petición al sistema central para obtener todas las faenas
            $response = Http::withToken($token)
                ->get(env('SISTEMA_CENTRAL_API') . '/faenas');

            if ($response->successful()) {
                $todasLasFaenas = $response->json('data', []);

                Log::info('🏭 [DUMPADAS] Faenas obtenidas del sistema central', [
                    'total_faenas' => count($todasLasFaenas),
                    'ids_faenas' => collect($todasLasFaenas)->pluck('id')->toArray(),
                    'ids_necesarios' => $idsFaena
                ]);

                // Crear mapa de faenas por ID para búsqueda rápida
                $faenasMap = collect($todasLasFaenas)->keyBy('id');

                // Mapear faenas a dumpadas usando id_faena directo o del frente de trabajo
                $dumpadasSinFaena = 0;
                foreach ($dumpadas as $dumpada) {
                    $idFaena = $dumpada->id_faena ?? $dumpada->frenteTrabajo?->id_faena;

                    if ($idFaena && isset($faenasMap[$idFaena])) {
                        // Asignar el objeto completo de la faena
                        $faenaData = $faenasMap[$idFaena];
                        $dumpada->faena_info = [
                            'id' => $faenaData['id'] ?? null,
                            'nombre' => $faenaData['ubicacion'] ?? $faenaData['nombre'] ?? null,
                        ];
                    } else {
                        $dumpada->faena_info = null;
                        $dumpadasSinFaena++;

                        // Log para las primeras 5 dumpadas sin faena
                        if ($dumpadasSinFaena <= 5) {
                            Log::warning('⚠️ [DUMPADAS] Dumpada sin faena_info', [
                                'dumpada_id' => $dumpada->id,
                                'id_faena_dumpada' => $dumpada->id_faena,
                                'id_faena_frente' => $dumpada->frenteTrabajo?->id_faena,
                                'existe_en_mapa' => isset($faenasMap[$idFaena])
                            ]);
                        }
                    }
                }

                if ($dumpadasSinFaena > 0) {
                    Log::warning('⚠️ [DUMPADAS] Total de dumpadas sin faena_info', [
                        'total' => $dumpadasSinFaena
                    ]);
                }
            } else {
                Log::warning('No se pudieron cargar faenas del sistema central para dumpadas', [
                    'status' => $response->status()
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error al cargar faenas del sistema central para dumpadas', [
                'message' => $e->getMessage()
            ]);
        }

        return $dumpadas;
    }

    /**
     * Obtener el nombre de una faena desde el sistema central
     */
    private function obtenerNombreFaena($idFaena, $token)
    {
        if (!$idFaena) {
            return null;
        }

        try {
            $response = Http::withToken($token)
                ->get(env('SISTEMA_CENTRAL_API') . '/faenas');

            if ($response->successful()) {
                $faenas = $response->json('data', []);
                $faena = collect($faenas)->firstWhere('id', $idFaena);

                if ($faena) {
                    return $faena['ubicacion'] ?? $faena['nombre'] ?? null;
                }
            }
        } catch (\Exception $e) {
            Log::error('Error al obtener nombre de faena', [
                'id_faena' => $idFaena,
                'message' => $e->getMessage()
            ]);
        }

        return null;
    }
}
