<?php

namespace App\Http\Controllers\Api\Explosivos;

use App\Http\Controllers\Controller;
use App\Models\Explosivos\ReportePerforacion;
use App\Models\Explosivos\LineaReportePerforacion;
use App\Models\Explosivos\ExplosivoLineaReporte;
use App\Models\Explosivos\FormulaExplosivo;
use App\Models\Explosivos\AuditoriaReportePerforacion;
use App\Models\Explosivos\Polvorin;
use App\Traits\MultiTenancy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Exception;

class ReportePerforacionController extends Controller
{
    // Mensajes para el rango de fecha del reporte (la app está en locale 'en').
    private const MENSAJES_FECHA = [
        'fecha.after_or_equal'  => 'La fecha del reporte no puede ser anterior al 01-01-2025. Revisa el año.',
        'fecha.before_or_equal' => 'La fecha del reporte no puede ser posterior a mañana. Revisa el año.',
    ];

    use MultiTenancy;

    /**
     * Faena por la que filtrar en el módulo de Ingeniería (Reportes P&T).
     * En Ingeniería todos los usuarios ven todas las faenas, así que el selector
     * de faena manda: si viene `faena_id`/`id_faena` se usa ese; si no, se cae a
     * la faena de la cuenta (comportamiento previo). null = todas las faenas.
     */
    private function faenaParaIngenieria($request)
    {
        $explicita = $request->input('faena_id') ?? $request->input('id_faena');
        if ($explicita !== null && $explicita !== '') {
            return (int) $explicita;
        }

        if ($this->esUsuarioGlobalIngenieria($request)) {
            return $request->auth_faena ?? null;
        }

        return $request->auth_faena;
    }

    /**
     * Nombre del usuario autenticado para auditoría. auth()->user() SIEMPRE es null
     * en este backend satélite: la sesión no pasa por el guard nativo de Laravel, la
     * valida ValidateTokenWithCentral contra el SAC y deja los datos del usuario en
     * $request->auth_user (array con 'nombre', 'rut', etc.), no en auth(). Usar
     * auth()->user()/auth()->id() acá siempre cae al fallback 'Sistema' sin importar
     * quién esté conectado — por eso el Historial del Reporte mostraba "Sistema" en
     * todas las acciones en vez del nombre real.
     */
    private function nombreUsuarioActual(): string
    {
        return request()->auth_user['nombre'] ?? 'Sistema';
    }

    /**
     * NULL siempre, a propósito. La tabla local `users` de este backend satélite está
     * vacía (0 filas) — nunca se pobló porque la autenticación real pasa por el SAC, no
     * por este Laravel. `auditoria_reportes_perforacion.user_id` y `reportes_perforacion.
     * user_id` tienen foreign key contra esa tabla `users` local, así que mandar el id del
     * usuario del SAC (`auth_user_id`, un espacio de ids totalmente distinto) revienta la
     * constraint con "Cannot add or update a child row" apenas ese id no calza con ninguna
     * fila local — como pasó en producción al usar esto acá. El nombre real ya queda
     * guardado en el campo `usuario` (texto) vía nombreUsuarioActual(); user_id se deja en
     * null hasta que este backend tenga una tabla `users` real y poblada que lo respalde.
     */
    private function idUsuarioActual(): ?int
    {
        return null;
    }

    private function registrarAuditoria($reporte, $accion, $cambios = null, $observaciones = null)
    {
        AuditoriaReportePerforacion::create([
            'id_reporte' => $reporte->id,
            'accion' => $accion,
            'usuario' => $this->nombreUsuarioActual(),
            'user_id' => $this->idUsuarioActual(),
            'cambios' => $cambios,
            'observaciones' => $observaciones,
        ]);
    }

    /**
     * GET /api/explosivos/reportes-perforacion
     */
    public function index(Request $request)
    {
        $query = ReportePerforacion::with([
            'lineas',
            'polvorin:id,codigo,nombre',
            'user:id,name',
        ])->withCount('lineas');

        // id_polvorin manda por sobre la faena de la cuenta: lo usa la vista de
        // "Solicitudes" del Polvorín (SolicitudesView.jsx), que ya sabe de qué
        // polvorín/faena está mostrando el stock (el usuario puede tener seleccionada
        // otra faena distinta a la suya propia). Antes este filtro se ignoraba acá,
        // así que la lista de reportes siempre caía a la faena de la cuenta del
        // usuario (auth_faena) sin importar qué polvorín se estuviera viendo — un
        // polvorinero viendo "Polvorín: Cabildo" en la cabecera veía reportes de su
        // propia faena (Catemu) en la lista de abajo.
        if ($request->filled('id_polvorin')) {
            $query->where('id_polvorin', $request->id_polvorin);
        } else {
            $idFaena = $this->faenaParaIngenieria($request);
            if ($idFaena !== null) {
                $query->where('id_faena', $idFaena);
            }
        }

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }
        if ($request->has('turno')) {
            $query->where('turno', $request->turno);
        }
        if ($request->filled('buscar')) {
            $query->where('codigo', 'like', '%' . $request->buscar . '%');
        }
        if ($request->has('fecha_desde')) {
            $query->where('fecha', '>=', $request->fecha_desde);
        }
        if ($request->has('fecha_hasta')) {
            $query->where('fecha', '<=', $request->fecha_hasta);
        }
        if ($request->has('id_frente_trabajo')) {
            $query->whereHas('lineas', function ($q) use ($request) {
                $q->where('id_frente_trabajo', $request->id_frente_trabajo);
            });
        }

        $reportes = $query->orderBy('fecha', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        // Calcular totales para cada reporte (líneas + extras, el consumo real)
        $reportes->getCollection()->transform(function ($reporte) {
            $reporte->load('lineas.explosivos.tipoExplosivo', 'extras.tipoExplosivo');
            $reporte->totales_explosivos = $reporte->calcularTotalesConExtras();
            return $reporte;
        });

        return response()->json($reportes);
    }

    /**
     * POST /api/explosivos/reportes-perforacion
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            // Rango acotado: un año mal tipeado (ej. '26' -> 0026-09-15) pasaba
            // la regla 'date' y el reporte quedaba fuera de todo período.
            'fecha' => 'required|date|after_or_equal:2025-01-01|before_or_equal:tomorrow',
            'turno' => 'required|in:AM,PM,Noche,Madrugada',
            'id_polvorin' => 'required|exists:polvorines,id',
            'observaciones' => 'nullable|string',
        ], self::MENSAJES_FECHA);

        if ($validator->fails()) {
            return response()->json(['mensaje' => 'Datos inválidos', 'errores' => $validator->errors()], 422);
        }

        try {
            // Derivar faena directamente del polvorín seleccionado
            $polvorinObj = Polvorin::findOrFail($request->id_polvorin);
            $idFaena = $polvorinObj->id_faena;

            // Validar duplicados: fecha + turno + polvorin + faena
            $duplicado = ReportePerforacion::where('fecha', $request->fecha)
                ->where('turno', $request->turno)
                ->where('id_polvorin', $request->id_polvorin)
                ->where('id_faena', $idFaena)
                ->exists();

            if ($duplicado) {
                return response()->json([
                    'mensaje' => "Ya existe un reporte para la fecha {$request->fecha}, turno {$request->turno} en este polvorín.",
                ], 422);
            }

            $reporte = ReportePerforacion::create([
                'codigo' => ReportePerforacion::generarCodigo($request->fecha, $request->turno, $polvorinObj->nombre),
                'fecha' => $request->fecha,
                'turno' => $request->turno,
                'estado' => ReportePerforacion::ESTADO_BORRADOR,
                'observaciones' => $request->observaciones,
                'id_polvorin' => $request->id_polvorin,
                'id_faena' => $idFaena,
                'user_id' => $this->idUsuarioActual(),
            ]);

            $this->registrarAuditoria($reporte, 'creado', null, "Reporte {$reporte->codigo} creado");

            return response()->json([
                'mensaje' => 'Reporte creado correctamente',
                'reporte' => $reporte->load('polvorin:id,codigo,nombre'),
            ], 201);
        } catch (Exception $e) {
            return response()->json(['mensaje' => 'Error al crear reporte', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/explosivos/reportes-perforacion/{id}
     */
    public function show($id)
    {
        $reporte = ReportePerforacion::with([
            'lineas.frenteTrabajo:id,codigo_completo,id_tipo_frente',
            'lineas.frenteTrabajo.tipoFrente:id,nombre,abreviatura',
            'lineas.personal:id,nombre,apellido,rut',
            'lineas.tipoFrente:id,nombre,abreviatura',
            'lineas.explosivos.tipoExplosivo:id,codigo,nombre,unidad_medida',
            'devoluciones.tipoExplosivo:id,codigo,nombre,unidad_medida',
            'devoluciones.personal:id,nombre,apellido',
            'extras.tipoExplosivo:id,codigo,nombre,unidad_medida',
            'extras.personal:id,nombre,apellido',
            'extras.lineaReporte.frenteTrabajo:id,codigo_completo',
            'movimientos.tipoExplosivo:id,codigo,nombre,unidad_medida',
            'polvorin:id,codigo,nombre',
            'user:id,name',
        ])->findOrFail($id);

        $reporte->totales_explosivos = $reporte->calcularTotalesExplosivos();

        return response()->json($reporte);
    }

    /**
     * PUT /api/explosivos/reportes-perforacion/{id}
     */
    public function update(Request $request, $id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_BORRADOR) {
            return response()->json(['mensaje' => 'Solo se pueden editar reportes en estado borrador'], 422);
        }

        $validator = Validator::make($request->all(), [
            'fecha' => 'sometimes|date|after_or_equal:2025-01-01|before_or_equal:tomorrow',
            'turno' => 'sometimes|in:AM,PM,Noche,Madrugada',
            'observaciones' => 'nullable|string',
        ], self::MENSAJES_FECHA);

        if ($validator->fails()) {
            return response()->json(['mensaje' => 'Datos inválidos', 'errores' => $validator->errors()], 422);
        }

        $cambios = [];
        foreach (['fecha', 'turno', 'observaciones'] as $campo) {
            if ($request->has($campo) && $reporte->$campo != $request->$campo) {
                $cambios[] = ['campo' => $campo, 'anterior' => $reporte->$campo, 'nuevo' => $request->$campo];
            }
        }

        $reporte->update($request->only(['fecha', 'turno', 'observaciones']));

        $cambioFechaOTurno = collect($cambios)->pluck('campo')->intersect(['fecha', 'turno'])->isNotEmpty();
        if ($cambioFechaOTurno) {
            $correlativo = substr($reporte->codigo, strrpos($reporte->codigo, '-') + 1);
            $reporte->codigo = ReportePerforacion::armarCodigo($reporte->fecha, $reporte->turno, $reporte->polvorin->nombre, $correlativo);
            $reporte->save();
        }

        if (!empty($cambios)) {
            $this->registrarAuditoria($reporte, 'actualizado', $cambios);
        }

        return response()->json([
            'mensaje' => 'Reporte actualizado',
            'reporte' => $reporte,
        ]);
    }

    /**
     * DELETE /api/explosivos/reportes-perforacion/{id}
     */
    public function destroy($id)
    {
        $reporte = ReportePerforacion::findOrFail($id);
        $usuario = $this->nombreUsuarioActual();
        $teniaMovimientos = $reporte->estado !== ReportePerforacion::ESTADO_BORRADOR;

        try {
            $reporte->eliminarConReversa($usuario);

            return response()->json([
                'mensaje' => $teniaMovimientos
                    ? 'Reporte eliminado. Los movimientos de stock fueron revertidos.'
                    : 'Reporte eliminado.',
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/lineas
     */
    public function agregarLinea(Request $request, $id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_BORRADOR) {
            return response()->json(['mensaje' => 'Solo se pueden agregar líneas a reportes en estado borrador'], 422);
        }

        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => ['required', Rule::exists('frentes_trabajo', 'id')->where('estado', 'activo')],
            'id_personal' => 'required|exists:personal_autorizado_explosivos,id',
            'id_tipo_frente' => 'required|exists:tipos_frente,id',
            'seccion_ancho' => 'nullable|numeric|min:0',
            'seccion_alto' => 'nullable|numeric|min:0',
            'numero_tiros' => 'required|integer|min:1',
            'largo_perforacion' => 'required|numeric|min:0',
            'barras_usadas' => 'nullable|array',
            'material' => 'nullable|in:oxido,sulfuro,esteril',
            'observaciones' => 'nullable|string|max:255',
            'explosivos' => 'nullable|array',
            'explosivos.*.id_tipo_explosivo' => 'required_with:explosivos|exists:tipos_explosivos,id',
            'explosivos.*.cantidad_calculada' => 'required_with:explosivos|numeric|min:0',
            'explosivos.*.cantidad_final' => 'required_with:explosivos|numeric|min:0',
        ], [
            'id_frente_trabajo.exists' => 'El frente de trabajo seleccionado no existe o está inactivo. Actualiza la página e intenta de nuevo.',
        ]);

        if ($validator->fails()) {
            return response()->json(['mensaje' => 'Datos inválidos', 'errores' => $validator->errors()], 422);
        }

        try {
            return DB::transaction(function () use ($request, $reporte) {
                $linea = LineaReportePerforacion::create([
                    'id_reporte' => $reporte->id,
                    'id_frente_trabajo' => $request->id_frente_trabajo,
                    'id_personal' => $request->id_personal,
                    'id_tipo_frente' => $request->id_tipo_frente,
                    'seccion_ancho' => $request->seccion_ancho,
                    'seccion_alto' => $request->seccion_alto,
                    'numero_tiros' => $request->numero_tiros,
                    'largo_perforacion' => $request->largo_perforacion,
                    'barras_usadas' => $request->barras_usadas,
                    'material' => $request->material,
                    'valores_editados' => false,
                    'observaciones' => $request->observaciones,
                ]);

                // Si se proporcionan explosivos editados, usarlos; si no, calcular
                if ($request->has('explosivos') && count($request->explosivos) > 0) {
                    $hayEdicion = false;
                    foreach ($request->explosivos as $exp) {
                        if (abs($exp['cantidad_calculada'] - $exp['cantidad_final']) > 0.01) {
                            $hayEdicion = true;
                        }
                        ExplosivoLineaReporte::create([
                            'id_linea_reporte' => $linea->id,
                            'id_tipo_explosivo' => $exp['id_tipo_explosivo'],
                            'cantidad_calculada' => $exp['cantidad_calculada'],
                            'cantidad_final' => $exp['cantidad_final'],
                        ]);
                    }
                    if ($hayEdicion) {
                        $linea->update(['valores_editados' => true]);
                    }
                } else {
                    // Calcular automáticamente
                    $explosivos = $linea->calcularExplosivos($reporte->id_faena);
                    foreach ($explosivos as $exp) {
                        ExplosivoLineaReporte::create([
                            'id_linea_reporte' => $linea->id,
                            'id_tipo_explosivo' => $exp['id_tipo_explosivo'],
                            'cantidad_calculada' => $exp['cantidad_calculada'],
                            'cantidad_final' => $exp['cantidad_final'],
                        ]);
                    }
                }

                $linea->load([
                    'frenteTrabajo:id,codigo_completo,id_tipo_frente',
                    'personal:id,nombre,apellido,rut',
                    'tipoFrente:id,nombre,abreviatura',
                    'explosivos.tipoExplosivo:id,codigo,nombre,unidad_medida',
                ]);

                return response()->json([
                    'mensaje' => 'Línea agregada',
                    'linea' => $linea,
                ], 201);
            });
        } catch (Exception $e) {
            return response()->json(['mensaje' => 'Error al agregar línea', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * PUT /api/explosivos/reportes-perforacion/{id}/lineas/{lineaId}
     */
    public function actualizarLinea(Request $request, $id, $lineaId)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_BORRADOR) {
            return response()->json(['mensaje' => 'Solo se pueden editar líneas de reportes en estado borrador'], 422);
        }

        $linea = LineaReportePerforacion::where('id_reporte', $id)->findOrFail($lineaId);

        $validator = Validator::make($request->all(), [
            'id_frente_trabajo' => 'sometimes|exists:frentes_trabajo,id',
            'id_personal' => 'sometimes|exists:personal_autorizado_explosivos,id',
            'id_tipo_frente' => 'sometimes|exists:tipos_frente,id',
            'seccion_ancho' => 'nullable|numeric|min:0',
            'seccion_alto' => 'nullable|numeric|min:0',
            'numero_tiros' => 'sometimes|integer|min:1',
            'largo_perforacion' => 'sometimes|numeric|min:0',
            'barras_usadas' => 'nullable|array',
            'material' => 'nullable|in:oxido,sulfuro,esteril',
            'observaciones' => 'nullable|string|max:255',
            'explosivos' => 'nullable|array',
            'explosivos.*.id_tipo_explosivo' => 'required_with:explosivos|exists:tipos_explosivos,id',
            'explosivos.*.cantidad_calculada' => 'required_with:explosivos|numeric|min:0',
            'explosivos.*.cantidad_final' => 'required_with:explosivos|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json(['mensaje' => 'Datos inválidos', 'errores' => $validator->errors()], 422);
        }

        // No permitir mover la línea a un frente inactivo (sí se permite dejarla en el
        // frente que ya tenía, aunque ese frente se haya desactivado después) — mismo
        // criterio que DumpadaController::update().
        if ($request->has('id_frente_trabajo') && $request->id_frente_trabajo != $linea->id_frente_trabajo) {
            $frenteNuevo = \App\Models\Ingenieria\FrenteTrabajo::find($request->id_frente_trabajo);
            if (!$frenteNuevo || $frenteNuevo->estado !== 'activo') {
                return response()->json([
                    'mensaje' => 'El frente de trabajo seleccionado está inactivo. Actualiza la página e intenta de nuevo.'
                ], 422);
            }
        }

        try {
            return DB::transaction(function () use ($request, $reporte, $linea) {
                $linea->update($request->only([
                    'id_frente_trabajo', 'id_personal', 'id_tipo_frente',
                    'seccion_ancho', 'seccion_alto', 'numero_tiros',
                    'largo_perforacion', 'barras_usadas', 'material', 'observaciones',
                ]));

                // Actualizar explosivos si se proporcionan
                if ($request->has('explosivos')) {
                    $linea->explosivos()->delete();
                    $hayEdicion = false;
                    foreach ($request->explosivos as $exp) {
                        if (abs($exp['cantidad_calculada'] - $exp['cantidad_final']) > 0.01) {
                            $hayEdicion = true;
                        }
                        ExplosivoLineaReporte::create([
                            'id_linea_reporte' => $linea->id,
                            'id_tipo_explosivo' => $exp['id_tipo_explosivo'],
                            'cantidad_calculada' => $exp['cantidad_calculada'],
                            'cantidad_final' => $exp['cantidad_final'],
                        ]);
                    }
                    $linea->update(['valores_editados' => $hayEdicion]);
                }

                $linea->load([
                    'frenteTrabajo:id,codigo_completo,id_tipo_frente',
                    'personal:id,nombre,apellido,rut',
                    'tipoFrente:id,nombre,abreviatura',
                    'explosivos.tipoExplosivo:id,codigo,nombre,unidad_medida',
                ]);

                return response()->json([
                    'mensaje' => 'Línea actualizada',
                    'linea' => $linea,
                ]);
            });
        } catch (Exception $e) {
            return response()->json(['mensaje' => 'Error al actualizar línea', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * DELETE /api/explosivos/reportes-perforacion/{id}/lineas/{lineaId}
     */
    public function eliminarLinea($id, $lineaId)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_BORRADOR) {
            return response()->json(['mensaje' => 'Solo se pueden eliminar líneas de reportes en estado borrador'], 422);
        }

        $linea = LineaReportePerforacion::where('id_reporte', $id)->findOrFail($lineaId);
        $linea->delete();

        return response()->json(['mensaje' => 'Línea eliminada']);
    }

    /**
     * POST /api/explosivos/reportes-perforacion/calcular
     */
    public function calcularExplosivos(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'numero_tiros' => 'required|integer|min:1',
            'id_tipo_frente' => 'required|exists:tipos_frente,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['mensaje' => 'Datos inválidos', 'errores' => $validator->errors()], 422);
        }

        $idFaena = $this->getFaenaParaFiltrar($request) ?? $request->auth_faena;

        // whereHas('tipoExplosivo', activos) — mismo fix que LineaReportePerforacion::
        // calcularExplosivos(): no calcular para tipos Inactivos en el Catálogo, aunque
        // les haya quedado una fórmula vieja configurada.
        $formulas = FormulaExplosivo::with('tipoExplosivo:id,codigo,nombre,unidad_medida')
            ->where('id_tipo_frente', $request->id_tipo_frente)
            ->where('id_faena', $idFaena)
            ->whereHas('tipoExplosivo', fn($q) => $q->activos())
            ->get();

        $resultados = $formulas->map(function ($formula) use ($request) {
            $calculada = round($request->numero_tiros * $formula->factor, 2);
            return [
                'id_tipo_explosivo' => $formula->id_tipo_explosivo,
                'tipo_explosivo' => $formula->tipoExplosivo,
                'factor' => $formula->factor,
                'cantidad_calculada' => $calculada,
                'cantidad_final' => $calculada,
            ];
        });

        return response()->json($resultados);
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/confirmar
     */
    public function confirmar(Request $request, $id)
    {
        $reporte = ReportePerforacion::with([
            'lineas.explosivos.tipoExplosivo',
        ])->findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_BORRADOR) {
            return response()->json(['mensaje' => 'Solo se pueden confirmar reportes en estado borrador'], 422);
        }

        if ($reporte->lineas->isEmpty()) {
            return response()->json(['mensaje' => 'El reporte debe tener al menos una línea'], 422);
        }

        $confirmadoPor = $request->input('confirmado_por', 'Sistema');

        try {
            $reporte->confirmar($confirmadoPor);

            $this->registrarAuditoria($reporte, 'confirmado', null, "Confirmado por {$confirmadoPor}");

            $reporte->load([
                'lineas.explosivos.tipoExplosivo',
                'movimientos.tipoExplosivo',
            ]);
            $reporte->totales_explosivos = $reporte->calcularTotalesExplosivos();

            return response()->json([
                'mensaje' => 'Reporte confirmado. El stock se descuenta cuando el polvorín lo cierre.',
                'reporte' => $reporte,
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/anular
     */
    public function anular($id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_CONFIRMADO) {
            return response()->json(['mensaje' => 'Solo se pueden anular reportes en estado confirmado'], 422);
        }

        try {
            $reporte->anular();

            $this->registrarAuditoria($reporte, 'anulado', null, 'Reporte anulado. Movimientos de salida revertidos.');

            $reporte->load([
                'lineas.explosivos.tipoExplosivo',
                'movimientos.tipoExplosivo',
                'polvorin:id,codigo,nombre',
            ]);
            $reporte->totales_explosivos = $reporte->calcularTotalesExplosivos();

            return response()->json([
                'mensaje' => 'Reporte anulado. Los movimientos de salida fueron revertidos y el stock restaurado.',
                'reporte' => $reporte,
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/reabrir
     */
    public function reabrir($id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_CERRADO) {
            return response()->json(['mensaje' => 'Solo se pueden reabrir reportes en estado cerrado'], 422);
        }

        try {
            $reporte->reabrir();

            $this->registrarAuditoria($reporte, 'reabierto', null, 'Reporte reabierto. Devoluciones revertidas, vuelve a Confirmado.');

            $reporte->load([
                'lineas.explosivos.tipoExplosivo',
                'devoluciones.tipoExplosivo',
                'extras.tipoExplosivo',
                'extras.lineaReporte.frenteTrabajo',
                'movimientos.tipoExplosivo',
                'polvorin:id,codigo,nombre',
            ]);
            $reporte->totales_explosivos = $reporte->calcularTotalesExplosivos();

            return response()->json([
                'mensaje' => 'Reporte reabierto. Vuelve a estado Confirmado — puedes anularlo para editar sus líneas.',
                'reporte' => $reporte,
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/habilitar-correccion
     *
     * Entra en modo corrección: revierte los movimientos de stock del reporte
     * (reabrir si estaba Cerrado + anular) y lo deja editable en borrador,
     * guardando un snapshot para poder deshacer o recuperar si queda a medias.
     */
    public function habilitarCorreccion($id)
    {
        $reporte = ReportePerforacion::findOrFail($id);
        $usuario = $this->nombreUsuarioActual();

        try {
            $estadoPrevio = $reporte->estado;
            $reporte->habilitarCorreccion($usuario);

            $this->registrarAuditoria(
                $reporte,
                'correccion_iniciada',
                null,
                "Corrección habilitada por {$usuario} (estado previo: {$estadoPrevio})"
            );

            $reporte->load([
                'lineas.frenteTrabajo:id,codigo_completo,id_tipo_frente',
                'lineas.personal:id,nombre,apellido,rut',
                'lineas.tipoFrente:id,nombre,abreviatura',
                'lineas.explosivos.tipoExplosivo:id,codigo,nombre,unidad_medida',
                'movimientos.tipoExplosivo:id,codigo,nombre,unidad_medida',
                'polvorin:id,codigo,nombre',
            ]);
            $reporte->totales_explosivos = $reporte->calcularTotalesExplosivos();

            return response()->json([
                'mensaje' => 'Corrección habilitada. Los movimientos de stock fueron revertidos; edita y confirma para regenerarlos.',
                'reporte' => $reporte,
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/confirmar-correccion
     *
     * Cierra la corrección: regenera los movimientos de salida con las líneas
     * actuales y, si el reporte venía Cerrado, lo vuelve a cerrar con las
     * devoluciones que la operadora revisó (no se recalculan solas).
     */
    public function confirmarCorreccion(Request $request, $id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if (!$reporte->en_correccion) {
            return response()->json(['mensaje' => 'Este reporte no está en corrección.'], 422);
        }

        if ($reporte->lineas()->count() === 0) {
            return response()->json(['mensaje' => 'El reporte debe tener al menos una línea para confirmar la corrección.'], 422);
        }

        $validator = Validator::make($request->all(), [
            'devoluciones' => 'nullable|array',
            'devoluciones.*.id_tipo_explosivo' => 'required_with:devoluciones|exists:tipos_explosivos,id',
            'devoluciones.*.cantidad' => 'required_with:devoluciones|numeric|min:0.01',
            'devoluciones.*.id_personal' => 'nullable|exists:personal_autorizado_explosivos,id',
            'devoluciones.*.motivo' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['mensaje' => 'Datos inválidos', 'errores' => $validator->errors()], 422);
        }

        $usuario = $this->nombreUsuarioActual();
        $veniaCerrado = $reporte->correccion_estado_previo === ReportePerforacion::ESTADO_CERRADO;

        try {
            $reporte->confirmarCorreccion($usuario, $request->input('devoluciones', []));

            $detalle = $veniaCerrado
                ? 'Corrección confirmada. Movimientos regenerados y reporte cerrado nuevamente.'
                : 'Corrección confirmada. Movimientos de salida regenerados.';
            $this->registrarAuditoria($reporte, 'correccion_confirmada', null, "{$detalle} Por {$usuario}");

            $reporte->load([
                'lineas.explosivos.tipoExplosivo',
                'devoluciones.tipoExplosivo',
                'extras.tipoExplosivo',
                'extras.lineaReporte.frenteTrabajo',
                'movimientos.tipoExplosivo',
                'polvorin:id,codigo,nombre',
            ]);
            $reporte->totales_explosivos = $reporte->calcularTotalesExplosivos();

            return response()->json([
                'mensaje' => $detalle,
                'reporte' => $reporte,
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/descartar-correccion
     *
     * Cancela la corrección: restaura líneas y devoluciones desde el snapshot y
     * vuelve el reporte a su estado original con los movimientos regenerados.
     */
    public function descartarCorreccion($id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if (!$reporte->en_correccion) {
            return response()->json(['mensaje' => 'Este reporte no está en corrección.'], 422);
        }

        $usuario = $this->nombreUsuarioActual();

        try {
            $reporte->descartarCorreccion($usuario);

            $this->registrarAuditoria($reporte, 'correccion_descartada', null, "Corrección descartada por {$usuario}. Reporte restaurado.");

            $reporte->load([
                'lineas.explosivos.tipoExplosivo',
                'devoluciones.tipoExplosivo',
                'extras.tipoExplosivo',
                'extras.lineaReporte.frenteTrabajo',
                'movimientos.tipoExplosivo',
                'polvorin:id,codigo,nombre',
            ]);
            $reporte->totales_explosivos = $reporte->calcularTotalesExplosivos();

            return response()->json([
                'mensaje' => 'Corrección descartada. El reporte volvió a su estado original.',
                'reporte' => $reporte,
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/cerrar
     */
    public function cerrar($id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_CONFIRMADO) {
            return response()->json(['mensaje' => 'Solo se pueden cerrar reportes en estado confirmado'], 422);
        }

        try {
            // Fecha real del reporte, no la de hoy -- si el polvorinero cierra un
            // reporte represado varios dias despues, el consumo debe quedar en el
            // mes que corresponde (ver [[bug_explosivos_preparado_descuento_excesivo]]).
            $reporte->cerrar([], $reporte->fecha->toDateString());

            $this->registrarAuditoria($reporte, 'cerrado', null, 'Cerrado sin devoluciones');

            $reporte->load(['movimientos.tipoExplosivo']);

            return response()->json([
                'mensaje' => 'Reporte cerrado sin devoluciones.',
                'reporte' => $reporte,
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/devoluciones
     */
    public function registrarDevoluciones(Request $request, $id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_CONFIRMADO) {
            return response()->json(['mensaje' => 'Solo se pueden registrar devoluciones en reportes confirmados'], 422);
        }

        $validator = Validator::make($request->all(), [
            'devoluciones' => 'required|array',
            'devoluciones.*.id_tipo_explosivo' => 'required|exists:tipos_explosivos,id',
            'devoluciones.*.cantidad' => 'required|numeric|min:0.01',
            'devoluciones.*.id_personal' => 'required|exists:personal_autorizado_explosivos,id',
            'devoluciones.*.motivo' => 'nullable|string|max:255',
        ], [
            'devoluciones.*.id_personal.required' => 'Indica qué perforista hizo cada devolución.',
        ]);

        if ($validator->fails()) {
            return response()->json(['mensaje' => $validator->errors()->first(), 'errores' => $validator->errors()], 422);
        }

        // Quien devuelve tiene que ser uno de los perforistas del reporte, y por tipo
        // no se puede devolver más de lo que se despachó (una devolución puede venir
        // repartida entre varios perforistas, por eso se suma por tipo).
        $perforistas = $reporte->lineas()->whereNotNull('id_personal')->pluck('id_personal')->map(fn ($v) => (int) $v)->unique();
        // Mismo total que muestra el modal como "Despachado" (con extras).
        $despachadoPorTipo = collect($reporte->calcularTotalesConExtras())
            ->mapWithKeys(fn ($t) => [(int) $t['id_tipo_explosivo'] => (float) $t['cantidad_total']]);
        $devueltoPorTipo = [];
        foreach ($request->devoluciones as $dev) {
            if (!$perforistas->contains((int) $dev['id_personal'])) {
                return response()->json(['mensaje' => 'La devolución debe asignarse a un perforista de este reporte.'], 422);
            }
            $idTipo = (int) $dev['id_tipo_explosivo'];
            $devueltoPorTipo[$idTipo] = ($devueltoPorTipo[$idTipo] ?? 0) + (float) $dev['cantidad'];
        }
        foreach ($devueltoPorTipo as $idTipo => $devuelto) {
            if (round($devuelto, 2) > round($despachadoPorTipo[$idTipo] ?? 0, 2)) {
                return response()->json(['mensaje' => 'La cantidad devuelta no puede superar lo despachado.'], 422);
            }
        }

        try {
            // Fecha real del reporte, no la de hoy -- ver nota en cerrar() arriba.
            $reporte->cerrar($request->devoluciones, $reporte->fecha->toDateString());

            $this->registrarAuditoria($reporte, 'cerrado', null, 'Cerrado con ' . count($request->devoluciones) . ' devolución(es)');

            $reporte->load([
                'devoluciones.tipoExplosivo',
                'devoluciones.personal',
                'movimientos.tipoExplosivo',
            ]);

            return response()->json([
                'mensaje' => 'Devoluciones registradas. El reporte fue cerrado.',
                'reporte' => $reporte,
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * POST /api/explosivos/reportes-perforacion/{id}/extras
     *
     * Registra un extra: material solicitado DESPUÉS de confirmado el reporte,
     * sin tocar las cantidades ya anotadas en las líneas. Solo válido mientras
     * el reporte está Confirmado (se cierra la ventana al cerrar el reporte,
     * igual que las devoluciones).
     */
    public function registrarExtra(Request $request, $id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_CONFIRMADO) {
            return response()->json(['mensaje' => 'Solo se pueden solicitar extras en reportes confirmados'], 422);
        }

        $validator = Validator::make($request->all(), [
            'id_tipo_explosivo' => 'required|exists:tipos_explosivos,id',
            'cantidad' => 'required|numeric|min:0.01',
            // La línea manda el operador — no se acepta id_personal directo del
            // cliente, así un extra no puede quedar atribuido a alguien que no
            // participó del reporte.
            'id_linea_reporte' => [
                'required',
                Rule::exists('lineas_reporte_perforacion', 'id')->where('id_reporte', $reporte->id),
            ],
            'motivo' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['mensaje' => 'Datos inválidos', 'errores' => $validator->errors()], 422);
        }

        try {
            $extra = $reporte->agregarExtra(
                (int) $request->id_tipo_explosivo,
                (float) $request->cantidad,
                $request->motivo,
                (int) $request->id_linea_reporte
            );

            $extra->load(['tipoExplosivo:id,codigo,nombre,unidad_medida', 'personal:id,nombre,apellido', 'lineaReporte.frenteTrabajo:id,codigo_completo']);

            $nombreExplosivo = $extra->tipoExplosivo->nombre ?? 'explosivo';
            $this->registrarAuditoria(
                $reporte,
                'extra_agregado',
                null,
                "Extra: +{$request->cantidad} {$nombreExplosivo} — {$request->motivo}"
            );

            $reporte->load([
                'extras.tipoExplosivo:id,codigo,nombre,unidad_medida',
                'extras.personal:id,nombre,apellido',
                'extras.lineaReporte.frenteTrabajo:id,codigo_completo',
            ]);

            return response()->json([
                'mensaje' => 'Extra registrado correctamente',
                'extra' => $extra,
                'extras' => $reporte->extras,
            ]);
        } catch (Exception $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }
    }

    /**
     * GET /api/explosivos/reportes-perforacion/estadisticas
     */
    /**
     * Dashboard de Perforación y Tronadura para Ingeniería. Mismos datos que
     * Dashboard Gerencial > Operaciones (PerforacionTronaduraService), limitados
     * a la faena del usuario o a la que eligió.
     *
     * GET /api/explosivos/reportes-perforacion/dashboard
     */
    public function dashboard(Request $request, \App\Services\Explosivos\PerforacionTronaduraService $service)
    {
        $idFaena = $this->faenaParaIngenieria($request);
        $fechaDesde = $request->get('fecha_desde', now()->subDays(29)->toDateString());
        $fechaHasta = $request->get('fecha_hasta', now()->toDateString());

        return response()->json([
            'data' => $service->dashboard($fechaDesde, $fechaHasta, $idFaena !== null ? [(int) $idFaena] : null),
        ]);
    }

    public function estadisticas(Request $request)
    {
        $idFaena = $this->faenaParaIngenieria($request);

        $fechaDesde = $request->get('fecha_desde', now()->subDays(30)->toDateString());
        $fechaHasta = $request->get('fecha_hasta', now()->toDateString());

        // Totales por estado (histórico, sin filtro de fecha) — como estaba.
        $totalesPorEstado = ReportePerforacion::when($idFaena !== null, fn ($q) => $q->where('id_faena', $idFaena))
            ->selectRaw('estado, COUNT(*) as total')
            ->groupBy('estado')
            ->pluck('total', 'estado');

        // Totales por estado ACOTADOS al mismo rango que los gráficos, para poder
        // mostrar KPI del período sin mezclar escalas con los gráficos.
        $totalesPorEstadoPeriodo = ReportePerforacion::when($idFaena !== null, fn ($q) => $q->where('id_faena', $idFaena))
            ->whereBetween('fecha', [$fechaDesde, $fechaHasta])
            ->selectRaw('estado, COUNT(*) as total')
            ->groupBy('estado')
            ->pluck('total', 'estado');

        // Rango real de fechas con reportes (para guiar cuando el período elegido está vacío).
        $rangoDatos = ReportePerforacion::when($idFaena !== null, fn ($q) => $q->where('id_faena', $idFaena))
            ->selectRaw('MIN(fecha) as primera, MAX(fecha) as ultima')
            ->first();

        // Consumo por periodo (real por fecha y tipo — como estaba)
        $consumoPorPeriodo = DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->join('explosivos_linea_reporte as e', 'e.id_linea_reporte', '=', 'l.id')
            ->join('tipos_explosivos as te', 'te.id', '=', 'e.id_tipo_explosivo')
            ->when($idFaena !== null, fn ($q) => $q->where('r.id_faena', $idFaena))
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$fechaDesde, $fechaHasta])
            ->selectRaw('r.fecha, te.codigo as tipo_explosivo, SUM(e.cantidad_final) as total')
            ->groupBy('r.fecha', 'te.codigo')
            ->orderBy('r.fecha')
            ->get();

        // Calculado vs Real por semana (lunes de cada semana) — el gráfico estrella:
        // ¿la fórmula está calibrada? Sumado sobre todos los tipos.
        $consumoSemanal = DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->join('explosivos_linea_reporte as e', 'e.id_linea_reporte', '=', 'l.id')
            ->when($idFaena !== null, fn ($q) => $q->where('r.id_faena', $idFaena))
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$fechaDesde, $fechaHasta])
            ->selectRaw('DATE(DATE_SUB(r.fecha, INTERVAL WEEKDAY(r.fecha) DAY)) as semana, '
                . 'SUM(e.cantidad_calculada) as total_calculado, SUM(e.cantidad_final) as total_real')
            ->groupBy('semana')
            ->orderBy('semana')
            ->get();

        // Tiros por dia, con quiebre por turno (el turno está en el reporte).
        $tirosPorDiaTurno = DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->when($idFaena !== null, fn ($q) => $q->where('r.id_faena', $idFaena))
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$fechaDesde, $fechaHasta])
            ->selectRaw('r.fecha, r.turno, COALESCE(SUM(l.numero_tiros), 0) as total_tiros')
            ->groupBy('r.fecha', 'r.turno')
            ->orderBy('r.fecha')
            ->get();

        // Compatibilidad: total por día sin quiebre.
        $tirosPorDia = $tirosPorDiaTurno
            ->groupBy('fecha')
            ->map(fn ($g, $fecha) => (object) ['fecha' => $fecha, 'total_tiros' => $g->sum('total_tiros')])
            ->values();

        // Consumo por frente
        $consumoPorFrente = DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->join('frentes_trabajo as ft', 'ft.id', '=', 'l.id_frente_trabajo')
            ->join('explosivos_linea_reporte as e', 'e.id_linea_reporte', '=', 'l.id')
            ->join('tipos_explosivos as te', 'te.id', '=', 'e.id_tipo_explosivo')
            ->when($idFaena !== null, fn ($q) => $q->where('r.id_faena', $idFaena))
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$fechaDesde, $fechaHasta])
            ->selectRaw('ft.codigo_completo as frente, te.codigo as tipo_explosivo, SUM(e.cantidad_final) as total, SUM(e.cantidad_calculada) as total_calculado')
            ->groupBy('ft.codigo_completo', 'te.codigo')
            ->orderByDesc('total')
            ->get();

        // Eficiencia: calculada vs final, por tipo
        $eficiencia = DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->join('explosivos_linea_reporte as e', 'e.id_linea_reporte', '=', 'l.id')
            ->join('tipos_explosivos as te', 'te.id', '=', 'e.id_tipo_explosivo')
            ->when($idFaena !== null, fn ($q) => $q->where('r.id_faena', $idFaena))
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$fechaDesde, $fechaHasta])
            ->selectRaw('te.codigo as tipo_explosivo, SUM(e.cantidad_calculada) as total_calculado, SUM(e.cantidad_final) as total_final')
            ->groupBy('te.codigo')
            ->orderByDesc('total_final')
            ->get();

        // Cobertura de stock: cuántos días dura el stock actual del polvorín al
        // ritmo de consumo del período. Solo con una faena elegida (un polvorín).
        $coberturaStock = [];
        $diasPeriodo = max(1, \Carbon\Carbon::parse($fechaDesde)->diffInDays(\Carbon\Carbon::parse($fechaHasta)) + 1);
        if ($idFaena !== null) {
            $polvorin = \App\Models\Explosivos\Polvorin::where('id_faena', $idFaena)->first();
            if ($polvorin) {
                $consumoPorTipo = collect($eficiencia)->keyBy('tipo_explosivo');
                $stocks = DB::table('stock_explosivos as s')
                    ->join('tipos_explosivos as te', 'te.id', '=', 's.id_tipo_explosivo')
                    ->where('s.id_polvorin', $polvorin->id)
                    ->select('te.codigo', 'te.unidad_medida', 's.cantidad')
                    ->get();

                foreach ($stocks as $st) {
                    $consumoPeriodo = (float) ($consumoPorTipo[$st->codigo]->total_final ?? 0);
                    $consumoDiario = $consumoPeriodo / $diasPeriodo;
                    $coberturaStock[] = [
                        'tipo_explosivo' => $st->codigo,
                        'unidad_medida' => $st->unidad_medida,
                        'stock_actual' => round((float) $st->cantidad, 2),
                        'consumo_periodo' => round($consumoPeriodo, 2),
                        'consumo_diario' => round($consumoDiario, 3),
                        'dias_cobertura' => $consumoDiario > 0 ? round($st->cantidad / $consumoDiario, 1) : null,
                    ];
                }
                // Orden: primero los que se acaban antes.
                usort($coberturaStock, function ($a, $b) {
                    if ($a['dias_cobertura'] === null) return 1;
                    if ($b['dias_cobertura'] === null) return -1;
                    return $a['dias_cobertura'] <=> $b['dias_cobertura'];
                });
            }
        }

        return response()->json([
            'totales_por_estado' => $totalesPorEstado,
            'totales_por_estado_periodo' => $totalesPorEstadoPeriodo,
            'consumo_por_periodo' => $consumoPorPeriodo,
            'consumo_semanal' => $consumoSemanal,
            'tiros_por_dia' => $tirosPorDia,
            'tiros_por_dia_turno' => $tirosPorDiaTurno,
            'consumo_por_frente' => $consumoPorFrente,
            'eficiencia' => $eficiencia,
            'cobertura_stock' => $coberturaStock,
            'dias_periodo' => $diasPeriodo,
            'fecha_desde' => $fechaDesde,
            'fecha_hasta' => $fechaHasta,
            'rango_datos' => $rangoDatos,
        ]);
    }

    /**
     * GET /api/explosivos/reportes-perforacion/{id}/historial
     */
    public function historial($id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        $historial = $reporte->auditoria()
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'accion' => $item->accion,
                    'usuario' => $item->usuario,
                    'cambios' => $item->cambios,
                    'observaciones' => $item->observaciones,
                    'fecha' => $item->created_at,
                ];
            });

        return response()->json(['data' => ['historial' => $historial]]);
    }
}
