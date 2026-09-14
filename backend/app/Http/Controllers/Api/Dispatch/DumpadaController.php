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
use Illuminate\Validation\Rule;
use App\Models\ConfiguracionSistema;
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
        $numeroDumpada = $request->get('numero_dumpada');
        $enMezcla = $request->get('en_mezcla'); // 'si' | 'no'
        $tipoMaterial = $request->get('tipo_material'); // 'mineral' | 'esteril'

        // Orden: fecha mas reciente primero (asi los imports historicos viejos no
        // tapan lo actual cuando no hay frente filtrado) y, dentro de un mismo dia,
        // agrupado por frente y luego por jornada/numero_jornada (AM-1, AM-2...) en
        // vez de intercalado por numero_dumpada global. Si se filtra un solo frente,
        // la cláusula de frente no hace nada y queda fecha -> jornada -> numero_jornada.
        $query = Dumpada::with(['frenteTrabajo.tipoFrente'])
            ->select('dumpadas.*')
            ->join('frentes_trabajo', 'frentes_trabajo.id', '=', 'dumpadas.id_frente_trabajo')
            ->orderBy('dumpadas.fecha', 'desc')
            ->orderBy('frentes_trabajo.codigo_completo')
            ->orderByRaw("FIELD(dumpadas.jornada, 'Madrugada', 'AM', 'PM', 'Noche')")
            ->orderBy('dumpadas.numero_jornada');

        // ✅ MULTI-FAENA: Respeta roles de usuario
        Log::info('🔍 [DUMPADAS] Filtro de faena', [
            'es_usuario_global' => $this->esUsuarioGlobal($request),
            'auth_faena' => $request->auth_faena,
            'id_faena_param' => $idFaena,
            'roles' => $request->auth_roles ?? []
        ]);

        if (!$this->esUsuarioGlobal($request)) {
            // OPERADOR / ENCARGADO DISPATCH: Solo su faena
            // dumpadas.* qualificado: frentes_trabajo tambien tiene id_faena, y con
            // orden=frente el query queda joineado con esa tabla (columna ambigua si no).
            $query->where('dumpadas.id_faena', $request->auth_faena);
            Log::info('🔒 [DUMPADAS] Filtrando por faena de operador', ['id_faena' => $request->auth_faena]);
        } else {
            // ADMIN GLOBAL: Permite filtrar por múltiples faenas
            if ($idFaena) {
                // Si contiene comas, es una lista de faenas
                if (strpos($idFaena, ',') !== false) {
                    $faenasArray = array_map('trim', explode(',', $idFaena));
                    $query->whereIn('dumpadas.id_faena', $faenasArray);
                    Log::info('🌐 [DUMPADAS] Filtrando por múltiples faenas', ['faenas' => $faenasArray]);
                } else {
                    // Una sola faena
                    $query->where('dumpadas.id_faena', $idFaena);
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
        // dumpadas.* qualificado: frentes_trabajo tambien tiene columna 'estado'
        // (activo/inactivo del frente), ambigua cuando orden=frente hace el join.
        if ($estado) {
            $query->where('dumpadas.estado', $estado);

            // Envio de Muestras pide especificamente estado=Ingresado para armar la cola
            // de "pendientes de enviar a laboratorio" (ver EnvioMuestrasView.jsx). Una
            // dumpada Esteril nunca va a laboratorio (no tiene ley que reportar) y se
            // quedaria ahi para siempre sin poder completarse - se excluye de esa cola
            // especifica. El resto de vistas (Historial sin filtrar por Ingresado) siguen
            // mostrando dumpadas Esteril con normalidad.
            if ($estado === Dumpada::ESTADO_INGRESADO) {
                $query->where('tipo_material', '!=', Dumpada::TIPO_MATERIAL_ESTERIL);
            }
        }

        // Filtro por jornada
        if ($jornada) {
            $query->where('jornada', $jornada);
        }

        // Filtro por tipo de material (Mineral/Esteril)
        if ($tipoMaterial) {
            $query->where('tipo_material', $tipoMaterial);
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

        // Filtro por número de dumpada exacto (a diferencia de "search", que hace LIKE)
        if ($numeroDumpada) {
            $query->where('numero_dumpada', $numeroDumpada);
        }

        // Filtro por uso en mezclas: 'no' = sin ningún registro en mezcla_dumpada (libre),
        // 'si' = con al menos un registro (completa o con paladas parciales)
        if ($enMezcla === 'no') {
            $query->whereDoesntHave('mezclaDumpadas');
        } elseif ($enMezcla === 'si') {
            $query->whereHas('mezclaDumpadas');
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
     * Resumen mensual agrupado por frente de trabajo y jornada
     */
    public function resumenSemana(Request $request)
    {
        $idFaena  = $request->get('id_faena');
        // fecha_desde/fecha_hasta son opcionales (el hub de Dispatch no las manda y
        // sigue viendo "este mes" como siempre) — el Dashboard Gerencial las usa para
        // reusar este mismo endpoint con el rango de fechas que el usuario elija ahí.
        $inicioMes = $request->get('fecha_desde', Carbon::now()->startOfMonth()->format('Y-m-d'));
        $finMes    = $request->get('fecha_hasta', Carbon::now()->endOfMonth()->format('Y-m-d'));

        $query = Dumpada::with('frenteTrabajo')
            ->whereDate('fecha', '>=', $inicioMes)
            ->whereDate('fecha', '<=', $finMes);

        if (!$this->esUsuarioGlobal($request)) {
            $query->where('id_faena', $request->auth_faena);
        } else {
            if ($idFaena) {
                if (strpos($idFaena, ',') !== false) {
                    $query->whereIn('id_faena', array_map('trim', explode(',', $idFaena)));
                } else {
                    $query->where('id_faena', $idFaena);
                }
            }
        }

        $dumpadas = $query->get(['id_frente_trabajo', 'jornada', 'ton', 'ley', 'ley_cup', 'nombre_maquina', 'estado']);

        $resultado = [];
        foreach ($dumpadas->groupBy('id_frente_trabajo') as $idFrente => $dumpadasFrente) {
            $frente   = $dumpadasFrente->first()->frenteTrabajo;
            $jornadas = [];

            foreach ($dumpadasFrente->groupBy('jornada') as $jornada => $dumpadasJornada) {
                $leyValues = $dumpadasJornada->whereNotNull('ley')->pluck('ley');
                $maquinas  = $dumpadasJornada->pluck('nombre_maquina')->filter()->unique()->values()->toArray();

                $jornadas[] = [
                    'jornada'        => $jornada,
                    'total_dumpadas' => $dumpadasJornada->count(),
                    'ton_total'      => round((float) $dumpadasJornada->sum('ton'), 2),
                    'ley_promedio'   => $leyValues->count() > 0 ? round($leyValues->avg(), 3) : null,
                    'maquinas'       => $maquinas,
                ];
            }

            $leyTotal = $dumpadasFrente->whereNotNull('ley')->pluck('ley');

            $resultado[] = [
                'id_frente_trabajo' => $idFrente,
                'frente'            => $frente?->codigo_completo ?? 'Sin frente',
                'total_dumpadas'    => $dumpadasFrente->count(),
                'ton_total'         => round((float) $dumpadasFrente->sum('ton'), 2),
                'ley_promedio'      => $leyTotal->count() > 0 ? round($leyTotal->avg(), 3) : null,
                'jornadas'          => $jornadas,
            ];
        }

        usort($resultado, fn($a, $b) => $b['total_dumpadas'] - $a['total_dumpadas']);

        return response()->json([
            'success' => true,
            'data'    => $resultado,
            'semana'  => ['inicio' => $inicioMes, 'fin' => $finMes],
        ]);
    }

    /**
     * Crear una nueva dumpada
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id_frente_trabajo'  => ['required', Rule::exists('frentes_trabajo', 'id')->where('estado', 'activo')],
            'jornada'            => 'required|in:AM,PM,Madrugada,Noche',
            'fecha'              => 'nullable|date',
            'hora'               => 'nullable|date_format:H:i',
            'ton'                => 'nullable|numeric|min:0',
            'ley'                => 'nullable|numeric|min:0',
            'ley_cup'            => 'nullable|numeric|min:0',
            'certificado'        => 'nullable|string|max:100',
            'tipo_material'      => 'nullable|in:mineral,esteril',
            'ley_visual'         => 'required_if:tipo_material,mineral|nullable|numeric|min:0',
            'id_maquina'         => 'nullable|integer',
            'nombre_maquina'     => 'nullable|string|max:150',
        ], [
            'id_frente_trabajo.exists' => 'El frente de trabajo seleccionado no existe o está inactivo. Actualiza la página e intenta de nuevo.',
            'ley_visual.required_if' => 'La Ley Visual es obligatoria salvo que la dumpada sea Estéril.',
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

        // Generar número de dumpada automáticamente (consecutivo por faena)
        $numeroDumpada = Dumpada::generarNumeroDumpada($frente->id_faena);

        // Usar la fecha proporcionada o la fecha actual, convertida al formato correcto
        $fecha = $this->convertirFecha($request->fecha) ?? now()->format('Y-m-d');

        // Generar número de jornada (secuencial por frente+jornada+fecha)
        $numeroJornada = Dumpada::generarNumeroJornada(
            $request->id_frente_trabajo,
            $request->jornada,
            $fecha
        );

        // Generar código de acopio (código completo de la dumpada)
        $fechaFormateada = Carbon::parse($fecha)->format('d.m.Y');
        $acopios = trim("{$frente->codigo_completo} {$numeroDumpada} {$fechaFormateada} {$request->jornada}-{$numeroJornada}");

        // Determinar el rango automáticamente basado en la ley
        $rango = $request->ley ? Dumpada::determinarRango($request->ley) : null;

        // Determinar el estado basado en si tiene los datos del laboratorio
        // Solo hay 2 estados: "Ingresado" (sin datos) o "Completado" (con todos los datos)
        $estado = Dumpada::ESTADO_INGRESADO; // Estado inicial: muestra enviada al laboratorio

        // Calcular ley_cup (capping) automáticamente si hay ley
        $leyCup = $request->ley ? Dumpada::calcularCapping($request->ley, $frente->id_faena) : null;

        // Si tiene los 3 datos del laboratorio, está completado
        if ($request->ley && $leyCup && $request->certificado) {
            $estado = Dumpada::ESTADO_COMPLETADO;
        }

        // Obtener el nombre de la faena desde el sistema central
        $nombreFaena = $this->obtenerNombreFaena($frente->id_faena, $request->bearerToken());

        // Crear la dumpada con los datos generados
        $data = [
            'id_frente_trabajo' => $request->id_frente_trabajo,
            'jornada' => $request->jornada,
            'numero_jornada' => $numeroJornada,
            'tipo_material' => $request->tipo_material ?? Dumpada::TIPO_MATERIAL_MINERAL,
            'ley_visual' => $request->ley_visual,
            // Tonelaje: si viene explícito del frontend (máquina o manual), usarlo directo.
            // Si no viene, usar la config de la faena con fallback al hardcoded.
            'ton' => $request->ton !== null
                ? (float) $request->ton
                : ConfiguracionSistema::obtener('tonelaje_dumpada_default', 4.6, $frente->id_faena),
            'ley' => $request->ley,
            'ley_cup' => $leyCup,
            'certificado' => $request->certificado,
            'numero_dumpada' => $numeroDumpada,
            'acopios' => $acopios,
            'fecha' => $fecha,
            'hora' => $request->hora ?? now()->format('H:i:s'),
            'rango' => $rango,
            'estado' => $estado,
            'user_id' => $request->auth_user_id,
            'id_faena' => $frente->id_faena, // ID numérico de la faena
            'faena' => $nombreFaena, // Nombre de la faena
            'id_maquina' => $request->id_maquina,
            'nombre_maquina' => $request->nombre_maquina,
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
            'dumpadas'                       => 'required|array|min:1|max:100',
            'dumpadas.*.id_frente_trabajo'   => ['required', Rule::exists('frentes_trabajo', 'id')->where('estado', 'activo')],
            'dumpadas.*.jornada'             => 'required|in:AM,PM,Madrugada,Noche',
            'dumpadas.*.fecha'               => 'nullable|date',
            'dumpadas.*.hora'                => 'nullable|date_format:H:i',
            'dumpadas.*.ton'                 => 'nullable|numeric|min:0',
            'dumpadas.*.ley'                 => 'nullable|numeric|min:0',
            'dumpadas.*.ley_cup'             => 'nullable|numeric|min:0',
            'dumpadas.*.certificado'         => 'nullable|string|max:100',
            'dumpadas.*.tipo_material'       => 'nullable|in:mineral,esteril',
            'dumpadas.*.ley_visual'          => 'required_if:dumpadas.*.tipo_material,mineral|nullable|numeric|min:0',
            'dumpadas.*.id_maquina'          => 'nullable|integer',
            'dumpadas.*.nombre_maquina'      => 'nullable|string|max:150',
        ], [
            'dumpadas.*.id_frente_trabajo.exists' => 'Uno de los frentes de trabajo seleccionados no existe o está inactivo. Actualiza la página e intenta de nuevo.',
            'dumpadas.*.ley_visual.required_if' => 'La Ley Visual es obligatoria salvo que la dumpada sea Estéril.',
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

                // Generar número de dumpada automáticamente (consecutivo por faena)
                $numeroDumpada = Dumpada::generarNumeroDumpada($frente->id_faena);

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

                // Generar código de acopio (código completo de la dumpada)
                $fechaFormateada = Carbon::parse($fecha)->format('d.m.Y');
                $acopios = trim("{$frente->codigo_completo} {$numeroDumpada} {$fechaFormateada} {$dumpadaData['jornada']}-{$numeroJornada}");

                // Determinar el rango automáticamente basado en la ley
                $rango = isset($dumpadaData['ley'])
                    ? Dumpada::determinarRango($dumpadaData['ley'])
                    : null;

                // Calcular ley_cup (capping) automáticamente si hay ley
                $leyCup = isset($dumpadaData['ley']) ? Dumpada::calcularCapping($dumpadaData['ley'], $frente->id_faena) : null;

                // Determinar el estado
                $estado = Dumpada::ESTADO_INGRESADO;

                if (isset($dumpadaData['ley']) && $leyCup && isset($dumpadaData['certificado'])) {
                    $estado = Dumpada::ESTADO_COMPLETADO;
                }

                // Obtener el nombre de la faena
                $nombreFaena = $this->obtenerNombreFaena($frente->id_faena, $request->bearerToken());

                // Crear la dumpada
                $data = [
                    'id_frente_trabajo' => $dumpadaData['id_frente_trabajo'],
                    'jornada' => $dumpadaData['jornada'],
                    'numero_jornada' => $numeroJornada,
                    'tipo_material' => $dumpadaData['tipo_material'] ?? Dumpada::TIPO_MATERIAL_MINERAL,
                    'ley_visual' => $dumpadaData['ley_visual'] ?? null,
                    // Tonelaje: si viene explícito del frontend (máquina o manual), usarlo directo.
                    // Si no viene, usar la config de la faena con fallback al hardcoded.
                    'ton' => isset($dumpadaData['ton']) && $dumpadaData['ton'] !== null
                        ? (float) $dumpadaData['ton']
                        : ConfiguracionSistema::obtener('tonelaje_dumpada_default', 4.6, $frente->id_faena),
                    'ley' => $dumpadaData['ley'] ?? null,
                    'ley_cup' => $leyCup,
                    'certificado' => $dumpadaData['certificado'] ?? null,
                    'numero_dumpada' => $numeroDumpada,
                    'acopios' => $acopios,
                    'fecha' => $fecha,
                    'hora' => $dumpadaData['hora'] ?? now()->format('H:i:s'),
                    'rango' => $rango,
                    'estado' => $estado,
                    'user_id' => $request->auth_user_id,
                    'id_faena' => $frente->id_faena,
                    'faena' => $nombreFaena,
                    'id_maquina' => $dumpadaData['id_maquina'] ?? null,
                    'nombre_maquina' => $dumpadaData['nombre_maquina'] ?? null,
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
            'id_frente_trabajo'  => 'required|exists:frentes_trabajo,id',
            'jornada'            => 'required|in:AM,PM,Madrugada,Noche',
            'fecha'              => 'nullable|date',
            'hora'               => 'nullable|date_format:H:i',
            'ton'                => 'nullable|numeric|min:0',
            'ley'                => 'nullable|numeric|min:0',
            'ley_cup'            => 'nullable|numeric|min:0',
            'certificado'        => 'nullable|string|max:100',
            'tipo_material'      => 'nullable|in:mineral,esteril',
            'ley_visual'         => 'required_if:tipo_material,mineral|nullable|numeric|min:0',
            'id_maquina'         => 'nullable|integer',
            'nombre_maquina'     => 'nullable|string|max:150',
            'para_muestreo'      => 'nullable|boolean',
        ], [
            'ley_visual.required_if' => 'La Ley Visual es obligatoria salvo que la dumpada sea Estéril.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // No permitir mover la dumpada a un frente inactivo (sí se permite dejarla
        // en el frente que ya tenía, aunque ese frente se haya desactivado después)
        if ($request->id_frente_trabajo != $dumpada->id_frente_trabajo) {
            $frenteNuevo = FrenteTrabajo::find($request->id_frente_trabajo);
            if (!$frenteNuevo || $frenteNuevo->estado !== 'activo') {
                return response()->json([
                    'success' => false,
                    'message' => 'El frente de trabajo seleccionado está inactivo. Actualiza la página e intenta de nuevo.'
                ], 422);
            }
        }

        // Obtener el frente de trabajo
        $frente = FrenteTrabajo::find($request->id_frente_trabajo);

        // Regenerar numero_jornada si cambiaron datos relevantes (frente, jornada o fecha)
        $fecha = $this->convertirFecha($request->fecha) ?? $dumpada->fecha;
        $numeroJornada = $dumpada->numero_jornada;

        $grupoAnterior = [
            'id_frente_trabajo' => $dumpada->id_frente_trabajo,
            'jornada'           => $dumpada->jornada,
            'fecha'             => $dumpada->getRawOriginal('fecha'),
        ];

        $seMovio = $request->id_frente_trabajo != $dumpada->id_frente_trabajo ||
            $request->jornada != $dumpada->jornada ||
            $this->convertirFecha($request->fecha) != $dumpada->getRawOriginal('fecha');

        if ($seMovio) {
            // Regenerar el número de jornada para la nueva combinación
            $numeroJornada = Dumpada::generarNumeroJornada(
                $request->id_frente_trabajo,
                $request->jornada,
                $fecha
            );
        }

        // Regenerar código de acopio con los datos actualizados (mismo formato que al crear, con numero_dumpada incluido)
        $fechaFormateada = Carbon::parse($fecha)->format('d.m.Y');
        $acopios = trim("{$frente->codigo_completo} {$dumpada->numero_dumpada} {$fechaFormateada} {$request->jornada}-{$numeroJornada}");

        // Determinar el rango automáticamente si cambió la ley
        $rango = $request->ley ? Dumpada::determinarRango($request->ley) : $dumpada->rango;

        // $request->filled(), no ??: si el campo Ley se deja en blanco en el formulario
        // de edición, el frontend manda ley:'' (string vacío), no null — '' ?? $x no cae
        // al fallback porque '' no es null, y el cast decimal del modelo termina
        // guardando 0.00 en vez de mantener el valor anterior (o NULL si nunca se había
        // cargado). filled() trata '' igual que "no venía", preservando el valor real.
        $ley = $request->filled('ley') ? $request->ley : $dumpada->ley;
        // Recalcular ley_cup automáticamente si hay ley
        $leyCup = $ley ? Dumpada::calcularCapping($ley, $frente->id_faena) : null;
        $certificado = $request->certificado ?? $dumpada->certificado;
        $tipoMaterial = $request->tipo_material ?? $dumpada->tipo_material;

        // Si el lab ya completó el análisis (Completado), preservar ese estado.
        // Dispatch no debe revertir un análisis completado aunque certificado sea NULL.
        if ($dumpada->estado === Dumpada::ESTADO_COMPLETADO) {
            $estado = Dumpada::ESTADO_COMPLETADO;
        } elseif ($ley && $leyCup && $certificado) {
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
            'hora' => $request->hora ?? $dumpada->hora,
            // filled(), no ?? — mismo motivo que $ley más arriba: un campo decimal
            // dejado en blanco manda '' (no null) y ?? no lo detecta, pisando el
            // valor real con 0.00.
            'ton' => $request->filled('ton') ? $request->ton : $dumpada->ton,
            'ley' => $ley,
            'ley_cup' => $leyCup,
            'certificado' => $request->filled('certificado') ? $request->certificado : $dumpada->certificado,
            'tipo_material' => $tipoMaterial,
            // filled(), no ?? — mismo motivo que ley/ton/certificado arriba. Si pasa a
            // Estéril y el campo viene vacío, se limpia a NULL (ya no aplica); si sigue
            // Mineral y viene vacío, se preserva el valor anterior en vez de guardar 0.
            'ley_visual' => $request->filled('ley_visual')
                ? $request->ley_visual
                : ($tipoMaterial === Dumpada::TIPO_MATERIAL_ESTERIL ? null : $dumpada->ley_visual),
            'acopios' => $acopios,
            'rango' => $rango,
            'estado' => $estado,
            'id_maquina' => $request->has('id_maquina') ? $request->id_maquina : $dumpada->id_maquina,
            'nombre_maquina' => $request->has('nombre_maquina') ? $request->nombre_maquina : $dumpada->nombre_maquina,
            'para_muestreo' => $request->has('para_muestreo') ? $request->para_muestreo : $dumpada->para_muestreo,
        ];

        $dumpada->update($data);

        // Si se movió a otro frente/jornada/fecha, cerrar el hueco de numero_jornada
        // que quedó en el grupo de origen (mismo criterio que al borrar).
        if ($seMovio) {
            Dumpada::renumerarNumeroJornada(
                $grupoAnterior['id_frente_trabajo'],
                $grupoAnterior['jornada'],
                $grupoAnterior['fecha']
            );
        }

        $dumpada->load('frenteTrabajo.tipoFrente');

        return response()->json([
            'success' => true,
            'message' => 'Dumpada actualizada exitosamente',
            'data' => $dumpada
        ], 200);
    }

    /**
     * Marcar dumpadas para muestreo de laboratorio (o quitar marca)
     * POST /api/dispatch/dumpadas/marcar-muestreo
     * Body: { ids: [1,2,3], para_muestreo: true|null }
     */
    public function marcarMuestreo(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids'           => 'required|array|min:1',
            'ids.*'         => 'required|integer|exists:dumpadas,id',
            'para_muestreo' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors()
            ], 422);
        }

        $ids = $request->ids;
        $paraMuestreo = $request->input('para_muestreo'); // null o true

        // Verificar que todas las dumpadas pertenezcan a la faena del usuario
        $dumpadas = Dumpada::whereIn('id', $ids)->get();

        foreach ($dumpadas as $dumpada) {
            $this->validarAccesoFaena($request, $dumpada->id_faena);
        }

        // Actualizar en batch — solo dumpadas con estado 'Ingresado'. Una dumpada Esteril
        // nunca deberia llegar aca (Envio de Muestras ya la excluye de la lista que arma
        // estos IDs), pero se excluye tambien aca como segunda barrera: no tiene ley que
        // reportar, no debe poder marcarse para enviar a laboratorio por ningun camino.
        $actualizadas = Dumpada::whereIn('id', $ids)
            ->where('estado', Dumpada::ESTADO_INGRESADO)
            ->where('tipo_material', '!=', Dumpada::TIPO_MATERIAL_ESTERIL)
            ->update(['para_muestreo' => $paraMuestreo]);

        return response()->json([
            'success'      => true,
            'message'      => $actualizadas . ' dumpada(s) actualizadas',
            'actualizadas' => $actualizadas,
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

        // Grupo al que pertenecía, para renumerar sus hermanas después de borrar
        $idFrente = $dumpada->id_frente_trabajo;
        $jornada  = $dumpada->jornada;
        $fecha    = $dumpada->getRawOriginal('fecha');

        DB::transaction(function () use ($dumpada, $idFrente, $jornada, $fecha) {
            $dumpada->delete();
            // Cierra el hueco de numero_jornada (AM-1, AM-3 -> AM-1, AM-2)
            Dumpada::renumerarNumeroJornada($idFrente, $jornada, $fecha);
        });

        return response()->json([
            'success' => true,
            'message' => 'Dumpada eliminada exitosamente'
        ], 200);
    }

    /**
     * Previsualizar próximo número de dumpada y código completo
     * Formato del código: "{codigo_frente} {numero_dumpada} {fecha} {jornada}-{numero_jornada}"
     * Ejemplo: "M3-11N 1234 29.09.2025 PM-1"
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

        // Generar número de dumpada automáticamente (consecutivo por faena)
        $numeroDumpada = Dumpada::generarNumeroDumpada($frente->id_faena);

        // Usar la fecha proporcionada o la fecha actual, convertida al formato correcto
        $fecha = $this->convertirFecha($request->fecha) ?? now()->format('Y-m-d');

        // Generar número de jornada (secuencial por frente+jornada+fecha)
        $numeroJornada = Dumpada::generarNumeroJornada(
            $request->id_frente_trabajo,
            $request->jornada,
            $fecha
        );

        // Generar código completo de la dumpada
        // Formato: "{codigo_frente} {numero_dumpada} {fecha} {jornada}-{numero_jornada}"
        $fechaFormateada = Carbon::parse($fecha)->format('d.m.Y');
        $codigoCompleto = trim("{$frente->codigo_completo} {$numeroDumpada} {$fechaFormateada} {$request->jornada}-{$numeroJornada}");

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
                ->get(config('services.sistema_central_api') . '/faenas');

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
                ->get(config('services.sistema_central_api') . '/faenas');

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
