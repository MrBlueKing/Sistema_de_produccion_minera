<?php

namespace App\Http\Controllers\Api\Laboratorio;

use App\Http\Controllers\Controller;
use App\Models\Laboratorio\Lote;
use App\Services\Laboratorio\LoteService;
use App\Services\Laboratorio\CamionadaService;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Exception;

class LoteController extends Controller
{
    use MultiTenancy;
    protected $loteService;
    protected $camionadaService;

    public function __construct(LoteService $loteService, CamionadaService $camionadaService)
    {
        $this->loteService = $loteService;
        $this->camionadaService = $camionadaService;
    }

    /**
     * Mismo permiso que habilita aprobar/rechazar certificados (ver
     * CertificadoController::tienePermisoAprobacion) — Jefe de Laboratorio
     * lo tiene, Análisis de Muestras no. Debe coincidir exactamente con el
     * permiso creado en el SAC (módulo Laboratorio).
     */
    private function tienePermisoGestionarLeyes(Request $request): bool
    {
        return in_array('aprobar_certificados_laboratorio', $request->input('auth_permisos') ?? []);
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
        $query = Lote::with(['planta', 'empresa', 'camionadas.mezclas']);

        // ✅ MULTI-FAENA: Filtrar por faena del usuario si no es global
        if (!$this->esUsuarioGlobal($request)) {
            $query->where('id_faena', $request->auth_faena);
        }

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

        // Filtro por estado_laboratorio: acepta uno o varios separados por coma
        // (usado por el apartado comercial de Gerencial, para no traer lotes
        // que todavia ni siquiera tienen Ley Paquete Segunda cargada).
        if ($request->has('estado_laboratorio') && !empty($request->estado_laboratorio)) {
            $estados = array_filter(array_map('trim', explode(',', $request->estado_laboratorio)));
            $query->whereIn('estado_laboratorio', $estados);
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
        $loteData['peso_teorico_pendiente'] = $lote->getPesoTeoricoPendiente();
        $loteData['remanente'] = $lote->getRemanente();
        $loteData['numero_camionadas'] = $lote->getNumeroCamionadas();

        // Calcular camionadas recepcionadas
        $camionadasRecepcionadas = $lote->camionadas
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

        // Preview del Saldo Líquido esperado (solo USD, sin tasa de cambio)
        // una vez que el lote ya tiene ley resuelta pero aún no se carga la
        // liquidación real — para "adelantar" el dato antes de que llegue el PDF.
        $loteData['saldo_preliminar'] = null;
        $loteData['saldo_detalle'] = null;
        if ($lote->liquidacion_numero === null && ($lote->ley_canje !== null || $lote->ley_paquete_tercera !== null)) {
            $preview = $lote->calcularSaldoLiquidoEsperado();
            $loteData['saldo_liquido_estimado_usd'] = $preview['saldo_liquido_usd'] ?? null;
            $loteData['saldo_detalle'] = isset($preview['error']) ? null : $preview;
        } else {
            $loteData['saldo_liquido_estimado_usd'] = null;
            // Antes de que exista Canje/Tercera: estimado con lo que ya haya de
            // Laboratorio (Segunda) y/o Planta (Primera) — pedido de gerencia
            // para saber cuánto se va a pagar aproximadamente antes del Canje.
            if ($lote->liquidacion_numero === null) {
                $preliminar = $lote->calcularSaldoPreliminar();
                if (!isset($preliminar['error'])) {
                    $loteData['saldo_preliminar'] = $preliminar;
                }
            }
        }

        // Ley resuelta (la que usa el calculo de liquidacion): Canje si hubo
        // acuerdo directo, si no la de Tercero. Null mientras siga sin resolver.
        $loteData['ley_resuelta'] = $lote->ley_canje ?? $lote->ley_paquete_tercera;

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
            $datos = $request->all();
            // Asignar la faena del usuario autenticado al lote
            if (!isset($datos['id_faena']) && $request->auth_faena) {
                $datos['id_faena'] = $request->auth_faena;
            }

            $lote = $this->loteService->crearLote($datos);

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
        $lote = Lote::with(['planta', 'empresa', 'camionadas.mezclas.detalles.dumpada'])->findOrFail($id);

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
     * DELETE /api/dispatch/lotes/{id}?opcion=reasignar|eliminar_camionadas&lote_destino_id=123
     *
     * Solo se pueden eliminar lotes en estado ABIERTO
     *
     * Opciones:
     * - reasignar: Mueve las camionadas al lote_destino_id indicado (debe estar ABIERTO)
     * - eliminar_camionadas: Elimina todas las camionadas (restaura toneladas a mezclas)
     */
    public function destroy(Request $request, $id)
    {
        try {
            $lote = Lote::with(['camionadas.mezclas', 'planta', 'empresa'])->findOrFail($id);

            $cantidadCamionadas = $lote->camionadas()->count();
            $opcion = $request->input('opcion', 'reasignar');

            \DB::beginTransaction();

            if ($cantidadCamionadas > 0) {
                switch ($opcion) {
                    case 'reasignar':
                        $loteDestinoId = $request->input('lote_destino_id');

                        if (empty($loteDestinoId)) {
                            throw new Exception('Debe indicar a qué lote reasignar las camionadas');
                        }

                        if ((int) $loteDestinoId === (int) $lote->id) {
                            throw new Exception('El lote destino no puede ser el mismo que se está eliminando');
                        }

                        $loteDestino = Lote::find($loteDestinoId);

                        if (!$loteDestino) {
                            throw new Exception('El lote destino indicado no existe');
                        }

                        if ($loteDestino->estado !== Lote::ESTADO_ABIERTO) {
                            throw new Exception('El lote destino debe estar Abierto');
                        }

                        $camionadaIds = $lote->camionadas()->pluck('id')->toArray();

                        try {
                            $userId = auth()->id();
                        } catch (\Exception $e) {
                            $userId = null;
                        }

                        $this->camionadaService->moverCamionadas($camionadaIds, (int) $loteDestinoId, $userId);

                        $mensaje = "Lote eliminado exitosamente. {$cantidadCamionadas} camionada(s) reasignada(s) al lote {$loteDestino->numero_lote}";
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

                    default:
                        throw new Exception("Opción inválida: {$opcion}");
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
     * Reabrir un lote Completado (volverlo a Abierto)
     * POST /api/dispatch/lotes/{id}/reabrir
     */
    public function reabrir($id)
    {
        try {
            $lote = Lote::findOrFail($id);
            $lote->reabrir();

            return response()->json([
                'mensaje' => 'Lote reabierto exitosamente',
                'lote' => $lote->load(['planta', 'empresa', 'camionadas'])
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al reabrir el lote',
                'mensaje' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Registrar/actualizar las leyes de la reconciliación de Laboratorio
     * (Paquete Primera, Paquete Segunda, Segunda Prima, Ley Canje).
     * Cada bloque se guarda por separado desde el frontend — solo se
     * actualizan los campos que vienen en el request.
     * PUT /api/dispatch/lotes/{id}/leyes-laboratorio
     */
    public function actualizarLeyesLaboratorio(Request $request, $id)
    {
        if (!$this->tienePermisoGestionarLeyes($request)) {
            return response()->json(['error' => 'No tiene permiso para gestionar leyes de laboratorio.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'ley_paquete_primera' => 'nullable|numeric|min:0|max:100',
            'ley_paquete_segunda' => 'nullable|numeric|min:0|max:100',
            'ley_paquete_segunda_prima' => 'nullable|numeric|min:0|max:100',
            'ley_canje' => 'nullable|numeric|min:0|max:100',
            'ley_paquete_tercera' => 'nullable|numeric|min:0|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = Lote::findOrFail($id);

            $campos = $request->only([
                'ley_paquete_primera',
                'ley_paquete_segunda',
                'ley_paquete_segunda_prima',
                'ley_canje',
                'ley_paquete_tercera',
            ]);
            $lote->fill($campos);

            // Cada ley guarda la fecha en que se cargó/actualizó ese dato puntual
            foreach (array_keys($campos) as $campo) {
                $lote->{"fecha_{$campo}"} = now();
            }

            $lote->actualizarEstadoLaboratorio();

            return response()->json([
                'mensaje' => 'Leyes actualizadas correctamente',
                'lote' => $this->agregarCamposCalculados($lote->fresh(['planta', 'empresa', 'camionadas.mezclas'])),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar las leyes',
                'mensaje' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Marcar el lote como enviado a laboratorio externo (Paquete Tercera)
     * POST /api/dispatch/lotes/{id}/enviar-a-tercero
     */
    public function enviarATercero(Request $request, $id)
    {
        if (!$this->tienePermisoGestionarLeyes($request)) {
            return response()->json(['error' => 'No tiene permiso para gestionar leyes de laboratorio.'], 403);
        }

        try {
            $lote = Lote::findOrFail($id);
            $lote->enviarATercero();

            return response()->json([
                'mensaje' => 'Lote marcado como enviado a Tercero',
                'lote' => $this->agregarCamposCalculados($lote->fresh(['planta', 'empresa', 'camionadas.mezclas'])),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al enviar a Tercero',
                'mensaje' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Registrar la liquidación real (documento ENAMI) de un lote.
     * PUT /api/dispatch/lotes/{id}/liquidacion
     */
    public function actualizarLiquidacion(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'numero' => 'required|string|max:50',
            'tasa_cambio' => 'required|numeric|min:0',
            'saldo_real_usd' => 'nullable|numeric',
            'saldo_real_clp' => 'nullable|numeric',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = Lote::findOrFail($id);
            $lote->registrarLiquidacion(
                $request->numero,
                (float) $request->tasa_cambio,
                $request->saldo_real_usd !== null ? (float) $request->saldo_real_usd : null,
                $request->saldo_real_clp !== null ? (float) $request->saldo_real_clp : null,
            );

            return response()->json([
                'mensaje' => 'Liquidación registrada correctamente',
                'lote' => $this->agregarCamposCalculados($lote->fresh(['planta', 'empresa', 'camionadas.mezclas'])),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al registrar la liquidación',
                'mensaje' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Registrar el anticipo pagado de un lote.
     * PUT /api/dispatch/lotes/{id}/anticipo
     */
    public function actualizarAnticipo(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'monto' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = Lote::findOrFail($id);
            $lote->registrarAnticipo((float) $request->monto);

            return response()->json([
                'mensaje' => 'Anticipo registrado correctamente',
                'lote' => $this->agregarCamposCalculados($lote->fresh(['planta', 'empresa', 'camionadas.mezclas'])),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al registrar el anticipo',
                'mensaje' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Registrar el pago final de un lote.
     * PUT /api/dispatch/lotes/{id}/pago
     */
    public function actualizarPago(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'monto' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'detalles' => $validator->errors()
            ], 422);
        }

        try {
            $lote = Lote::findOrFail($id);
            $lote->registrarPago((float) $request->monto);

            return response()->json([
                'mensaje' => 'Pago registrado correctamente',
                'lote' => $this->agregarCamposCalculados($lote->fresh(['planta', 'empresa', 'camionadas.mezclas'])),
            ]);
        } catch (Exception $e) {
            return response()->json([
                'error' => 'Error al registrar el pago',
                'mensaje' => $e->getMessage()
            ], 400);
        }
    }

    /**
     * Reconstrucción completa de un lote
     * GET /api/dispatch/lotes/{id}/reconstruccion
     */
    public function reconstruccion($id)
    {
        $lote = Lote::with([
            'planta',
            'empresa',
            'camionadas.mezclas.detalles.dumpada.frenteTrabajo',
        ])->findOrFail($id);

        $loteData = [
            'id'                => $lote->id,
            'numero_lote'       => $lote->numero_lote,
            'planta'            => $lote->planta ? ['nombre' => $lote->planta->nombre, 'codigo' => $lote->planta->codigo] : null,
            'empresa'           => $lote->empresa ? ['nombre' => $lote->empresa->nombre] : null,
            'estado'            => $lote->estado,
            'fecha_creacion'    => $lote->fecha_creacion,
            'peso_total'        => $lote->getPesoTotal(),
            'peso_recibido'     => $lote->getPesoRecibido(),
            'ley_lote_promedio' => $lote->getLeyLotePromedio(),
            'ley_lab_promedio'  => $lote->getLeyLabPromedio(),
            'numero_camionadas' => $lote->getNumeroCamionadas(),
        ];

        $camionadas = $lote->camionadas->map(function ($camionada) {
            $mezclas = $camionada->mezclas->map(function ($mezcla) {
                $componentes = $mezcla->detalles->map(function ($detalle) {
                    if ($detalle->tipo === 'DUMP' && $detalle->dumpada) {
                        $d = $detalle->dumpada;
                        $frente = $d->frenteTrabajo;
                        return [
                            'tipo'              => 'DUMP',
                            'toneladas'         => (float) $detalle->toneladas,
                            'numero_paladas'    => $detalle->numero_paladas !== null ? (float) $detalle->numero_paladas : null,
                            'ley_dump_ajustada' => $detalle->ley_dump_ajustada !== null ? (float) $detalle->ley_dump_ajustada : null,
                            'ley_lab_capado'    => $detalle->ley_lab_capado !== null ? (float) $detalle->ley_lab_capado : null,
                            'ley_visual_mezcla' => $detalle->ley_visual !== null ? (float) $detalle->ley_visual : null,
                            'ley_lote'          => $detalle->ley_lote !== null ? (float) $detalle->ley_lote : null,
                            'numero_dumpada'    => $d->numero_dumpada,
                            'fecha'             => $d->fecha,
                            'jornada'           => $d->jornada,
                            'frente'            => $frente ? ($frente->codigo_completo ?? $frente->manto ?? "Frente #{$d->id_frente_trabajo}") : null,
                            'tiene_lab'         => !is_null($d->ley),
                            'ley_lab'           => $d->ley !== null ? (float) $d->ley : null,
                            'ley_cup'           => $d->ley_cup !== null ? (float) $d->ley_cup : null,
                            'cu_soluble'        => $d->cu_soluble !== null ? (float) $d->cu_soluble : null,
                            'cu_insoluble'      => $d->cu_insoluble !== null ? (float) $d->cu_insoluble : null,
                            'ley_visual'        => $d->ley_visual !== null ? (float) $d->ley_visual : null,
                            'rango'             => $d->rango,
                            'certificado'       => $d->certificado,
                        ];
                    }
                    return [
                        'tipo'                   => 'REM',
                        'origen'                 => $detalle->origen,
                        'toneladas'              => (float) $detalle->toneladas,
                        'numero_paladas'         => $detalle->numero_paladas !== null ? (float) $detalle->numero_paladas : null,
                        'toneladas_reales_origen' => $detalle->toneladas_reales_origen !== null ? (float) $detalle->toneladas_reales_origen : null,
                        'ley_dump_ajustada'      => $detalle->ley_dump_ajustada !== null ? (float) $detalle->ley_dump_ajustada : null,
                        'ley_lote'               => $detalle->ley_lote !== null ? (float) $detalle->ley_lote : null,
                        'ley_visual_mezcla'      => $detalle->ley_visual !== null ? (float) $detalle->ley_visual : null,
                    ];
                });

                return [
                    'id'              => $mezcla->id,
                    'codigo'          => $mezcla->codigo,
                    'toneladas_pivot' => (float) $mezcla->pivot->toneladas,
                    'ley_prom_dump'   => $mezcla->ley_prom_dump !== null ? (float) $mezcla->ley_prom_dump : null,
                    'ley_prom_lote'   => $mezcla->ley_prom_lote !== null ? (float) $mezcla->ley_prom_lote : null,
                    'ley_lab'         => $mezcla->ley_lab !== null ? (float) $mezcla->ley_lab : null,
                    'es_remanente'    => (bool) $mezcla->es_remanente,
                    'componentes'     => $componentes,
                ];
            });

            return [
                'id'               => $camionada->id,
                'numero_camionada' => $camionada->numero_camionada,
                'patente'          => $camionada->patente,
                'fecha'            => $camionada->fecha_despacho,
                'peso'             => $camionada->peso !== null ? (float) $camionada->peso : null,
                'peso_real'        => $camionada->peso_real !== null ? (float) $camionada->peso_real : null,
                'estado'           => $camionada->estado,
                'ley_mezcla'       => $camionada->ley_mezcla !== null ? (float) $camionada->ley_mezcla : null,
                'ley_lab_camion'   => $camionada->ley_lab_camion !== null ? (float) $camionada->ley_lab_camion : null,
                'mezclas'          => $mezclas,
            ];
        });

        return response()->json([
            'lote'       => $loteData,
            'camionadas' => $camionadas,
        ]);
    }

    /**
     * Obtener lotes abiertos por planta y empresa
     * GET /api/dispatch/lotes/abiertos
     */
    public function lotesAbiertos(Request $request)
    {
        $query = Lote::with(['planta', 'empresa'])
            ->where('estado', Lote::ESTADO_ABIERTO);

        // ✅ MULTI-FAENA: Filtrar por faena del usuario si no es global
        if (!$this->esUsuarioGlobal($request)) {
            $query->where('id_faena', $request->auth_faena);
        }

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
        $query = Lote::with(['planta', 'empresa', 'camionadas.mezclas'])
            ->where('estado', Lote::ESTADO_ABIERTO);

        if (!$this->esUsuarioGlobal($request)) {
            $query->where('id_faena', $request->auth_faena);
        }

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
