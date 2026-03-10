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
use Exception;

class ReportePerforacionController extends Controller
{
    use MultiTenancy;

    private function registrarAuditoria($reporte, $accion, $cambios = null, $observaciones = null)
    {
        AuditoriaReportePerforacion::create([
            'id_reporte' => $reporte->id,
            'accion' => $accion,
            'usuario' => auth()->user()?->name ?? 'Sistema',
            'user_id' => auth()->id(),
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

        $this->aplicarFiltroFaena($query, $request);

        if ($request->has('estado')) {
            $query->where('estado', $request->estado);
        }
        if ($request->has('turno')) {
            $query->where('turno', $request->turno);
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

        // Calcular totales para cada reporte
        $reportes->getCollection()->transform(function ($reporte) {
            $reporte->load('lineas.explosivos.tipoExplosivo');
            $reporte->totales_explosivos = $reporte->calcularTotalesExplosivos();
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
            'fecha' => 'required|date',
            'turno' => 'required|in:AM,PM,Noche',
            'id_polvorin' => 'required|exists:polvorines,id',
            'observaciones' => 'nullable|string',
        ]);

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
                'codigo' => ReportePerforacion::generarCodigo(),
                'fecha' => $request->fecha,
                'turno' => $request->turno,
                'estado' => ReportePerforacion::ESTADO_BORRADOR,
                'observaciones' => $request->observaciones,
                'id_polvorin' => $request->id_polvorin,
                'id_faena' => $idFaena,
                'user_id' => auth()->id(),
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
            'fecha' => 'sometimes|date',
            'turno' => 'sometimes|in:AM,PM,Noche',
            'observaciones' => 'nullable|string',
        ]);

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

        if ($reporte->estado !== ReportePerforacion::ESTADO_BORRADOR) {
            return response()->json(['mensaje' => 'Solo se pueden eliminar reportes en estado borrador'], 422);
        }

        $reporte->delete();

        return response()->json(['mensaje' => 'Reporte eliminado']);
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
            'id_frente_trabajo' => 'required|exists:frentes_trabajo,id',
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

        $formulas = FormulaExplosivo::with('tipoExplosivo:id,codigo,nombre,unidad_medida')
            ->where('id_tipo_frente', $request->id_tipo_frente)
            ->where('id_faena', $idFaena)
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
                'mensaje' => 'Reporte confirmado. Se generaron los movimientos de salida.',
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
     * POST /api/explosivos/reportes-perforacion/{id}/cerrar
     */
    public function cerrar($id)
    {
        $reporte = ReportePerforacion::findOrFail($id);

        if ($reporte->estado !== ReportePerforacion::ESTADO_CONFIRMADO) {
            return response()->json(['mensaje' => 'Solo se pueden cerrar reportes en estado confirmado'], 422);
        }

        try {
            $reporte->cerrar([]);

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
            'devoluciones.*.id_personal' => 'nullable|exists:personal_autorizado_explosivos,id',
            'devoluciones.*.motivo' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['mensaje' => 'Datos inválidos', 'errores' => $validator->errors()], 422);
        }

        try {
            $reporte->cerrar($request->devoluciones);

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
     * GET /api/explosivos/reportes-perforacion/estadisticas
     */
    public function estadisticas(Request $request)
    {
        $idFaena = $this->getFaenaParaFiltrar($request) ?? $request->auth_faena;

        $fechaDesde = $request->get('fecha_desde', now()->subDays(30)->toDateString());
        $fechaHasta = $request->get('fecha_hasta', now()->toDateString());

        // Totales por estado
        $totalesPorEstado = ReportePerforacion::where('id_faena', $idFaena)
            ->selectRaw('estado, COUNT(*) as total')
            ->groupBy('estado')
            ->pluck('total', 'estado');

        // Consumo por periodo
        $consumoPorPeriodo = DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->join('explosivos_linea_reporte as e', 'e.id_linea_reporte', '=', 'l.id')
            ->join('tipos_explosivos as te', 'te.id', '=', 'e.id_tipo_explosivo')
            ->where('r.id_faena', $idFaena)
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$fechaDesde, $fechaHasta])
            ->selectRaw('r.fecha, te.codigo as tipo_explosivo, SUM(e.cantidad_final) as total')
            ->groupBy('r.fecha', 'te.codigo')
            ->orderBy('r.fecha')
            ->get();

        // Consumo por frente
        $consumoPorFrente = DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->join('frentes_trabajo as ft', 'ft.id', '=', 'l.id_frente_trabajo')
            ->join('explosivos_linea_reporte as e', 'e.id_linea_reporte', '=', 'l.id')
            ->join('tipos_explosivos as te', 'te.id', '=', 'e.id_tipo_explosivo')
            ->where('r.id_faena', $idFaena)
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$fechaDesde, $fechaHasta])
            ->selectRaw('ft.codigo_completo as frente, te.codigo as tipo_explosivo, SUM(e.cantidad_final) as total, SUM(e.cantidad_calculada) as total_calculado')
            ->groupBy('ft.codigo_completo', 'te.codigo')
            ->orderByDesc('total')
            ->get();

        // Eficiencia: calculada vs final
        $eficiencia = DB::table('reportes_perforacion as r')
            ->join('lineas_reporte_perforacion as l', 'l.id_reporte', '=', 'r.id')
            ->join('explosivos_linea_reporte as e', 'e.id_linea_reporte', '=', 'l.id')
            ->join('tipos_explosivos as te', 'te.id', '=', 'e.id_tipo_explosivo')
            ->where('r.id_faena', $idFaena)
            ->where('r.estado', '!=', 'borrador')
            ->whereBetween('r.fecha', [$fechaDesde, $fechaHasta])
            ->selectRaw('te.codigo as tipo_explosivo, SUM(e.cantidad_calculada) as total_calculado, SUM(e.cantidad_final) as total_final')
            ->groupBy('te.codigo')
            ->get();

        return response()->json([
            'totales_por_estado' => $totalesPorEstado,
            'consumo_por_periodo' => $consumoPorPeriodo,
            'consumo_por_frente' => $consumoPorFrente,
            'eficiencia' => $eficiencia,
            'fecha_desde' => $fechaDesde,
            'fecha_hasta' => $fechaHasta,
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
