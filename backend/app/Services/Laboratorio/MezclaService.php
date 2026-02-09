<?php

namespace App\Services\Laboratorio;

use App\Models\Dispatch\Dumpada;
use App\Models\Dispatch\Acopio;
use App\Models\Laboratorio\Mezcla;
use App\Models\Laboratorio\MezclaDumpada;
use App\Models\Laboratorio\LoteVenta;
use Illuminate\Support\Facades\DB;
use Exception;
use Illuminate\Support\Facades\Log;

class MezclaService
{
    /**
     * Crear una nueva mezcla con acopios, dumpadas individuales y remanentes
     *
     * @param array $datos [
     *   'codigo' => 'CZ1224' (opcional, se genera automáticamente),
     *   'fecha' => '2025-11-17',
     *   'id_faena' => 1,
     *   'user_id' => 1,
     *   'acopios' => [1, 2, 3, ...], // IDs de acopios (NUEVO)
     *   'dumpadas' => [4157, 4158, 4159, ...], // IDs de dumpadas individuales (opcional para compatibilidad)
     *   'lotes_venta_remanentes' => [1, 2], // IDs de lotes con remanentes (opcional)
     *   'remanentes_manuales' => [ // Remanentes sin origen de lote (opcional)
     *      [
     *          'origen' => 'Stock manual: 4 paladas',
     *          'toneladas' => 7.28,
     *          'ley_dump' => 1.12,
     *          'ley_visual' => 1.08,
     *          'ley_lote' => 0.93
     *      ]
     *   ],
     *   'observaciones' => 'Texto opcional'
     * ]
     * @return Mezcla
     * @throws Exception
     */
    public function crearMezcla(array $datos)
    {
        DB::beginTransaction();

        try {
            // 1. Validar y procesar ACOPIOS si existen
            $acopiosIds = $datos['acopios'] ?? [];
            $acopios = [];
            if (!empty($acopiosIds)) {
                $acopios = Acopio::whereIn('id', $acopiosIds)->get();

                if ($acopios->count() !== count($acopiosIds)) {
                    throw new Exception('Algunos acopios no existen');
                }

                // Verificar que los acopios puedan usarse en mezclas
                foreach ($acopios as $acopio) {
                    if ($acopio->estado === Acopio::ESTADO_EN_MEZCLA) {
                        throw new Exception("El acopio {$acopio->codigo_acopio} ya está en uso en otra mezcla");
                    }
                }
            }

            // 2. Validar y procesar DUMPADAS INDIVIDUALES si existen (para compatibilidad)
            $dumpadasIds = $datos['dumpadas'] ?? [];
            $dumpadas = [];
            if (!empty($dumpadasIds)) {
                $dumpadas = Dumpada::whereIn('id', $dumpadasIds)->get();

                if ($dumpadas->count() !== count($dumpadasIds)) {
                    throw new Exception('Algunas dumpadas no existen');
                }

                // Verificar que las dumpadas no estén en otra mezcla
                foreach ($dumpadas as $dumpada) {
                    if ($dumpada->estaEnMezcla()) {
                        throw new Exception("La dumpada #{$dumpada->numero_dumpada} ya está en una mezcla");
                    }
                    // Verificar que la dumpada no esté en un acopio
                    if ($dumpada->estaEnAcopio()) {
                        throw new Exception("La dumpada #{$dumpada->numero_dumpada} está en un acopio. Debe usar el acopio completo.");
                    }
                }
            }

            // Validar que al menos haya acopios o dumpadas
            if (empty($acopiosIds) && empty($dumpadasIds)) {
                throw new Exception('Debe proporcionar al menos un acopio o dumpadas individuales');
            }

            // 3. Generar código si no se proporciona (usa el prefijo de la planta)
            $plantaId = $datos['planta_id'] ?? null;
            $codigo = $datos['codigo'] ?? Mezcla::generarCodigo($plantaId);

            // 4. Crear la mezcla
            $mezcla = Mezcla::create([
                'codigo' => $codigo,
                'fecha' => $datos['fecha'] ?? now(),
                'id_faena' => $datos['id_faena'] ?? null,
                'planta_id' => $plantaId,
                'toneladas_disponibles' => 0, // Inicializar en 0, se calculará después
                'toneladas_despachadas' => 0, // Inicializar en 0
                'user_id' => $datos['user_id'] ?? null,
                'observaciones' => $datos['observaciones'] ?? null,
                'estado' => Mezcla::ESTADO_CONFIRMADO,
            ]);

            // 5. Agregar dumpadas desde ACOPIOS
            foreach ($acopios as $acopio) {
                // Obtener todas las dumpadas del acopio
                $dumpadasDelAcopio = $acopio->dumpadas;

                foreach ($dumpadasDelAcopio as $dumpada) {
                    MezclaDumpada::desdeDumpada($dumpada, $mezcla->id);
                }

                // Marcar el acopio como EN_MEZCLA
                $acopio->update(['estado' => Acopio::ESTADO_EN_MEZCLA]);
            }

            // 6. Agregar dumpadas individuales si existen
            foreach ($dumpadas as $dumpada) {
                MezclaDumpada::desdeDumpada($dumpada, $mezcla->id);
            }

            // 7. Agregar remanentes de mezclas existentes si existen
            if (isset($datos['remanentes_mezclas']) && is_array($datos['remanentes_mezclas'])) {
                foreach ($datos['remanentes_mezclas'] as $remanente) {
                    $mezclaOrigen = Mezcla::find($remanente['mezcla_id']);

                    if (!$mezclaOrigen) {
                        throw new Exception("Mezcla origen #{$remanente['mezcla_id']} no encontrada");
                    }

                    $toneladasUsar = $remanente['toneladas'];

                    // Validar que haya suficientes toneladas disponibles
                    if ($toneladasUsar > $mezclaOrigen->toneladas_disponibles) {
                        throw new Exception("La mezcla {$mezclaOrigen->codigo} solo tiene {$mezclaOrigen->toneladas_disponibles} ton disponibles, solicitadas: {$toneladasUsar} ton");
                    }

                    // Crear registro en mezcla_dumpada con tipo REM
                    // IMPORTANTE: Los remanentes necesitan tratamiento especial para la ley visual
                    $factorAjuste = \App\Config\MezclaConfig::getFactorAjusteLey();
                    $factorRemanenteVisual = \App\Config\MezclaConfig::getFactorRemanenteVisual();

                    // Para ley_dump: revertir factor 0.9 para obtener original
                    $leyDumpOriginal = $mezclaOrigen->ley_prom_dump ? round($mezclaOrigen->ley_prom_dump / $factorAjuste, 2) : null;

                    // Para ley_lote: usar directamente (ya tiene factor 0.81)
                    $leyLoteRemanente = $mezclaOrigen->ley_prom_lote;

                    // Para ley_visual: calcular como ley_prom_lote × 1.11 (SIN dividir por 0.9)
                    // ley_prom_lote ya tiene factor 0.81, entonces:
                    // ley × 0.81 × 1.11 = ley × 0.8991
                    // Luego en calcularTotales() × 0.9 = ley × 0.809
                    $leyVisualRemanente = $mezclaOrigen->ley_prom_lote
                        ? round($mezclaOrigen->ley_prom_lote * $factorRemanenteVisual, 2)
                        : null;

                    \Log::info('🔄 [REMANENTE] Agregando remanente a mezcla', [
                        'mezcla_origen' => $mezclaOrigen->codigo,
                        'toneladas_usar' => $toneladasUsar,
                        'ley_prom_dump_origen' => $mezclaOrigen->ley_prom_dump,
                        'ley_prom_lote_origen' => $mezclaOrigen->ley_prom_lote,
                        'ley_dump_original_calculada' => $leyDumpOriginal,
                        'ley_lote_remanente' => $leyLoteRemanente,
                        'ley_visual_remanente_calculada' => $leyVisualRemanente,
                        'calculo_visual' => $mezclaOrigen->ley_prom_lote ? "{$mezclaOrigen->ley_prom_lote} × {$factorRemanenteVisual} = {$leyVisualRemanente}" : 'NULL'
                    ]);

                    MezclaDumpada::create([
                        'mezcla_id' => $mezcla->id,
                        'dumpada_id' => null,
                        'tipo' => MezclaDumpada::TIPO_REMANENTE,
                        'origen' => "Remanente de {$mezclaOrigen->codigo}",
                        'toneladas' => $toneladasUsar,
                        'ley_dump_ajustada' => $leyDumpOriginal, // Ley original (sin factor 0.9)
                        'ley_visual' => $leyVisualRemanente, // (ley_prom_lote × 1.11) / 0.9
                        'ley_lote' => $leyLoteRemanente, // Con factor 0.81 (directo de mezcla origen)
                    ]);

                    // Descontar toneladas de la mezcla origen
                    $mezclaOrigen->descontarToneladas($toneladasUsar);
                }
            }

            // 8. Agregar remanentes de lotes de venta si existen (legacy)
            if (isset($datos['lotes_venta_remanentes']) && is_array($datos['lotes_venta_remanentes'])) {
                foreach ($datos['lotes_venta_remanentes'] as $loteVentaId) {
                    $loteVenta = LoteVenta::find($loteVentaId);

                    if (!$loteVenta) {
                        throw new Exception("Lote de venta #{$loteVentaId} no encontrado");
                    }

                    if (!$loteVenta->tieneRemanente()) {
                        throw new Exception("Lote {$loteVenta->numero_lote} no tiene remanente disponible");
                    }

                    // Verificar que no se haya usado antes
                    $yaUsado = MezclaDumpada::where('lote_venta_id', $loteVentaId)
                        ->where('tipo', MezclaDumpada::TIPO_REMANENTE)
                        ->exists();

                    if ($yaUsado) {
                        throw new Exception("Remanente del lote {$loteVenta->numero_lote} ya fue utilizado");
                    }

                    MezclaDumpada::desdeLoteVenta($loteVenta, $mezcla->id);
                }
            }

            // 9. Agregar remanentes manuales si existen
            if (isset($datos['remanentes_manuales']) && is_array($datos['remanentes_manuales'])) {
                foreach ($datos['remanentes_manuales'] as $remanente) {
                    MezclaDumpada::desdeRemanente(
                        $mezcla->id,
                        $remanente['toneladas'],
                        $remanente['ley_dump'],
                        $remanente['ley_visual'] ?? null,
                        $remanente['ley_lote'] ?? null,
                        $remanente['origen'],
                        null // Sin lote_venta_id para remanentes manuales
                    );
                }
            }

            // 10. Calcular totales y promedios
            $mezcla->calcularTotales();
            $mezcla->save();

            DB::commit();

            // Recargar con relaciones
            return $mezcla->fresh(['detalles.dumpada']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Actualizar la ley de laboratorio de una mezcla
     *
     * @param int $mezclaId
     * @param float $leyLab
     * @return Mezcla
     */
    public function actualizarLeyLaboratorio($mezclaId, $leyLab)
    {
        $mezcla = Mezcla::findOrFail($mezclaId);
        $mezcla->ley_lab = $leyLab;
        $mezcla->estado = Mezcla::ESTADO_DESPACHADO;
        $mezcla->save();

        return $mezcla;
    }

    /**
     * Agregar dumpadas adicionales a una mezcla existente
     *
     * @param int $mezclaId
     * @param array $dumpadasIds
     * @return Mezcla
     * @throws Exception
     */
    public function agregarDumpadas($mezclaId, array $dumpadasIds)
    {
        DB::beginTransaction();

        try {
            $mezcla = Mezcla::findOrFail($mezclaId);

            // Validar que no tenga ajuste aplicado
            if ($mezcla->ajuste_aplicado) {
                throw new Exception('No se pueden agregar dumpadas a una mezcla con ajuste de toneladas aplicado');
            }
            $dumpadas = Dumpada::whereIn('id', $dumpadasIds)->get();

            if ($dumpadas->count() !== count($dumpadasIds)) {
                throw new Exception('Algunas dumpadas no existen');
            }

            foreach ($dumpadas as $dumpada) {
                if ($dumpada->estaEnMezcla()) {
                    throw new Exception("La dumpada #{$dumpada->n_acop} ya está en una mezcla");
                }

                MezclaDumpada::desdeDumpada($dumpada, $mezcla->id);
            }

            // Recalcular totales
            $mezcla->calcularTotales();
            $mezcla->save();

            DB::commit();

            return $mezcla->fresh(['detalles.dumpada']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Agregar un remanente manual a una mezcla existente
     *
     * @param int $mezclaId
     * @param array $remanente
     * @return Mezcla
     */
    public function agregarRemanente($mezclaId, array $remanente)
    {
        DB::beginTransaction();

        try {
            $mezcla = Mezcla::findOrFail($mezclaId);

            MezclaDumpada::desdeRemanente(
                $mezcla->id,
                $remanente['toneladas'],
                $remanente['ley_dump'],
                $remanente['ley_visual'] ?? null,
                $remanente['ley_lote'] ?? null,
                $remanente['origen'],
                null
            );

            // Recalcular totales
            $mezcla->calcularTotales();
            $mezcla->save();

            DB::commit();

            return $mezcla->fresh(['detalles.dumpada']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Agregar remanente de un lote de venta a una mezcla existente
     *
     * @param int $mezclaId
     * @param int $loteVentaId
     * @return Mezcla
     */
    public function agregarRemanenteDesdelote($mezclaId, $loteVentaId)
    {
        DB::beginTransaction();

        try {
            $mezcla = Mezcla::findOrFail($mezclaId);
            $loteVenta = LoteVenta::with('mezcla')->findOrFail($loteVentaId);

            if (!$loteVenta->tieneRemanente()) {
                throw new Exception("Lote {$loteVenta->numero_lote} no tiene remanente disponible");
            }

            // Verificar que no se haya usado antes
            $yaUsado = MezclaDumpada::where('lote_venta_id', $loteVentaId)
                ->where('tipo', MezclaDumpada::TIPO_REMANENTE)
                ->exists();

            if ($yaUsado) {
                throw new Exception("Remanente del lote {$loteVenta->numero_lote} ya fue utilizado");
            }

            MezclaDumpada::desdeLoteVenta($loteVenta, $mezcla->id);

            // Recalcular totales
            $mezcla->calcularTotales();
            $mezcla->save();

            DB::commit();

            return $mezcla->fresh(['detalles.dumpada', 'detalles.loteVenta']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Eliminar una dumpada o remanente de una mezcla
     * IMPORTANTE: Libera acopios y restaura toneladas de remanentes
     *
     * @param int $mezclaId
     * @param int $detalleId (ID del registro mezcla_dumpada)
     * @return Mezcla
     */
    public function eliminarDetalle($mezclaId, $detalleId)
    {
        DB::beginTransaction();

        try {
            $mezcla = Mezcla::findOrFail($mezclaId);

            // Validar que no tenga ajuste aplicado
            if ($mezcla->ajuste_aplicado) {
                throw new Exception('No se pueden eliminar detalles de una mezcla con ajuste de toneladas aplicado');
            }
            $detalle = MezclaDumpada::where('mezcla_id', $mezclaId)
                ->where('id', $detalleId)
                ->firstOrFail();

            // Si es un REMANENTE, restaurar toneladas a la mezcla origen
            if ($detalle->tipo === MezclaDumpada::TIPO_REMANENTE) {
                if (preg_match('/Remanente de (.+)/', $detalle->origen, $matches)) {
                    $codigoMezclaOrigen = $matches[1];
                    $mezclaOrigen = Mezcla::where('codigo', $codigoMezclaOrigen)->first();

                    if ($mezclaOrigen) {
                        $mezclaOrigen->restaurarToneladas($detalle->toneladas);
                    }
                }
            }

            // Si es una DUMPADA, verificar si el acopio debe liberarse
            if ($detalle->tipo === MezclaDumpada::TIPO_DUMPADA && $detalle->dumpada_id) {
                $dumpada = Dumpada::find($detalle->dumpada_id);
                if ($dumpada) {
                    // Buscar el acopio que contiene esta dumpada
                    $acopio = Acopio::whereHas('dumpadas', function($q) use ($dumpada) {
                        $q->where('dumpadas.id', $dumpada->id);
                    })->where('estado', Acopio::ESTADO_EN_MEZCLA)->first();

                    if ($acopio) {
                        // Verificar si TODAS las dumpadas del acopio fueron removidas de esta mezcla
                        $dumpadasDelAcopio = $acopio->dumpadas()->pluck('dumpadas.id')->toArray();
                        $dumpadasEnMezcla = MezclaDumpada::where('mezcla_id', $mezclaId)
                            ->where('id', '!=', $detalleId) // Excluir el que estamos eliminando
                            ->whereIn('dumpada_id', $dumpadasDelAcopio)
                            ->count();

                        // Si no quedan dumpadas del acopio en la mezcla, liberarlo
                        if ($dumpadasEnMezcla === 0) {
                            $acopio->update(['estado' => Acopio::ESTADO_CERRADO]);
                        }
                    }
                }
            }

            $detalle->delete();

            // Recalcular totales
            $mezcla->calcularTotales();
            $mezcla->save();

            DB::commit();

            return $mezcla->fresh(['detalles.dumpada']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Obtener todas las dumpadas disponibles (no incluidas en mezclas)
     *
     * @param array $filtros ['fecha_desde' => ..., 'fecha_hasta' => ..., 'id_faena' => ...]
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function obtenerDumpadasDisponibles(array $filtros = [])
    {
        Log::info('🔎 [SERVICE] Buscando dumpadas disponibles', [
            'filtros' => $filtros
        ]);

        // Contar totales primero para debug
        $totalDumpadas = Dumpada::count();
        $dumpadasCompletadas = Dumpada::where('estado', Dumpada::ESTADO_COMPLETADO)->count();
        $dumpadasEnMezcla = Dumpada::whereHas('mezclaDumpada')->count();

        Log::info('📊 [SERVICE] Estadísticas de dumpadas', [
            'total_dumpadas' => $totalDumpadas,
            'completadas' => $dumpadasCompletadas,
            'ya_en_mezcla' => $dumpadasEnMezcla,
            'disponibles_estimadas' => $dumpadasCompletadas - $dumpadasEnMezcla
        ]);

        // Dumpadas que NO están en mezcla y tienen al menos ley O ley_visual
        $query = Dumpada::whereDoesntHave('mezclaDumpada')
            ->where(function($q) {
                $q->whereNotNull('ley')
                  ->orWhereNotNull('ley_visual');
            });

        if (isset($filtros['fecha_desde'])) {
            $query->where('fecha', '>=', $filtros['fecha_desde']);
        }

        if (isset($filtros['fecha_hasta'])) {
            $query->where('fecha', '<=', $filtros['fecha_hasta']);
        }

        if (isset($filtros['id_faena'])) {
            $query->where('id_faena', $filtros['id_faena']);
        }

        // Seleccionar solo los campos necesarios para optimizar
        // Ordenar por ID descendente (más recientes primero)
        // IMPORTANTE: No usar numero_dumpada porque es STRING y ordenará alfabéticamente
        // Por eso "999" > "4307" (incorrecto). El ID sí es numérico y creciente.
        // ✅ SIN LÍMITE - Mostrará TODAS las dumpadas disponibles

        $dumpadas = $query->with(['frenteTrabajo:id,codigo_completo'])
            ->select(['id', 'numero_dumpada', 'acopios', 'fecha', 'ton', 'ley', 'ley_visual', 'jornada', 'id_frente_trabajo', 'estado'])
            ->orderBy('id', 'desc') // Cambiado de numero_dumpada a id
            ->get();

        Log::info('✅ [SERVICE] Resultado final', [
            'dumpadas_encontradas' => $dumpadas->count(),
            'con_ley' => $dumpadas->whereNotNull('ley')->count(),
            'con_ley_visual' => $dumpadas->whereNotNull('ley_visual')->count(),
            'ejemplo_primera_dumpada' => $dumpadas->first() ? [
                'id' => $dumpadas->first()->id,
                'numero_dumpada' => $dumpadas->first()->numero_dumpada,
                'estado' => $dumpadas->first()->estado,
                'ley' => $dumpadas->first()->ley,
                'ley_visual' => $dumpadas->first()->ley_visual,
            ] : 'No hay dumpadas',
            'ejemplo_ultima_dumpada' => $dumpadas->last() ? [
                'id' => $dumpadas->last()->id,
                'numero_dumpada' => $dumpadas->last()->numero_dumpada,
            ] : 'No hay dumpadas'
        ]);

        return $dumpadas;
    }

    /**
     * Editar un detalle específico de una mezcla (solo remanentes)
     * Los detalles tipo DUMP no se pueden editar porque vienen de dumpadas
     *
     * @param int $mezclaId
     * @param int $detalleId
     * @param array $datos ['toneladas', 'ley_dump', 'ley_visual', 'ley_lote', 'origen']
     * @return Mezcla
     * @throws Exception
     */
    public function editarDetalle($mezclaId, $detalleId, array $datos)
    {
        DB::beginTransaction();

        try {
            $mezcla = Mezcla::findOrFail($mezclaId);
            $detalle = MezclaDumpada::where('mezcla_id', $mezclaId)
                ->where('id', $detalleId)
                ->firstOrFail();

            // Validar que la mezcla no esté despachada
            if ($mezcla->estado === Mezcla::ESTADO_DESPACHADO) {
                throw new Exception('No se puede editar una mezcla que ya está despachada');
            }

            // Solo se pueden editar remanentes manuales
            if ($detalle->tipo === MezclaDumpada::TIPO_DUMPADA) {
                throw new Exception('No se pueden editar detalles de dumpadas. Solo remanentes manuales.');
            }

            // Actualizar campos permitidos
            if (isset($datos['toneladas'])) {
                $detalle->toneladas = $datos['toneladas'];
            }

            if (isset($datos['ley_dump'])) {
                $detalle->ley_dump_ajustada = MezclaDumpada::aplicarAjusteLey($datos['ley_dump']);
            }

            if (isset($datos['ley_visual'])) {
                $detalle->ley_visual = $datos['ley_visual'];
            }

            if (isset($datos['ley_lote'])) {
                $detalle->ley_lote = $datos['ley_lote'];
            }

            if (isset($datos['origen'])) {
                $detalle->origen = $datos['origen'];
            }

            $detalle->save();

            // Recalcular totales de la mezcla
            $mezcla->calcularTotales();
            $mezcla->save();

            DB::commit();

            return $mezcla->fresh(['detalles.dumpada']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Actualizar campos básicos de una mezcla
     *
     * @param int $mezclaId
     * @param array $datos ['codigo', 'fecha', 'estado', 'observaciones']
     * @return Mezcla
     * @throws Exception
     */
    public function actualizarMezcla($mezclaId, array $datos)
    {
        DB::beginTransaction();

        try {
            $mezcla = Mezcla::findOrFail($mezclaId);

            // Verificar si el código ya existe (si se está cambiando)
            if (isset($datos['codigo']) && $datos['codigo'] !== $mezcla->codigo) {
                $existe = Mezcla::where('codigo', $datos['codigo'])
                    ->where('id', '!=', $mezclaId)
                    ->exists();

                if ($existe) {
                    throw new Exception("El código {$datos['codigo']} ya está en uso");
                }
            }

            // Actualizar solo campos permitidos
            $camposPermitidos = ['codigo', 'fecha', 'estado', 'observaciones'];
            foreach ($camposPermitidos as $campo) {
                if (isset($datos[$campo])) {
                    $mezcla->$campo = $datos[$campo];
                }
            }

            $mezcla->save();

            DB::commit();

            return $mezcla->fresh(['detalles.dumpada']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Generar reporte de una mezcla
     *
     * @param int $mezclaId
     * @return array
     */
    public function generarReporte($mezclaId)
    {
        $mezcla = Mezcla::with(['detalles.dumpada.frenteTrabajo'])->findOrFail($mezclaId);

        return [
            'mezcla' => [
                'codigo' => $mezcla->codigo,
                'fecha' => $mezcla->fecha->format('d-m-Y'),
                'estado' => $mezcla->estado,
            ],
            'totales' => [
                'toneladas' => $mezcla->total_ton,
                'ley_prom_dump' => $mezcla->ley_prom_dump,
                'ley_prom_visual' => $mezcla->ley_prom_visual,
                'ley_prom_lote' => $mezcla->ley_prom_lote,
                'ley_lab' => $mezcla->ley_lab,
            ],
            'detalles' => $mezcla->detalles->map(function ($detalle) {
                return [
                    'id' => $detalle->id,
                    'tipo' => $detalle->tipo,
                    'origen' => $detalle->origen,
                    'toneladas' => $detalle->toneladas,
                    'ley_dump_ajustada' => $detalle->ley_dump_ajustada,
                    'ley_visual' => $detalle->ley_visual,
                    'ley_lote' => $detalle->ley_lote,
                    'dumpada' => $detalle->dumpada ? [
                        'n_acop' => $detalle->dumpada->n_acop,
                        'acopios' => $detalle->dumpada->acopios,
                        'frente' => $detalle->dumpada->frenteTrabajo->codigo ?? null,
                    ] : null,
                ];
            }),
        ];
    }

    /**
     * Aplicar ajuste manual de toneladas a una mezcla
     *
     * @param int $mezclaId
     * @param float $toneladasRealesRemanente - Toneladas reales confirmadas del remanente
     * @param string $motivo - Motivo del ajuste
     * @param int $userId - ID del usuario que aplica el ajuste
     * @return Mezcla
     * @throws Exception
     */
    public function aplicarAjusteToneladas($mezclaId, $toneladasRealesRemanente, $motivo, $userId = null)
    {
        DB::beginTransaction();

        try {
            $mezcla = Mezcla::findOrFail($mezclaId);

            // Aplicar el ajuste usando el método del modelo
            $mezcla->aplicarAjusteToneladas($toneladasRealesRemanente, $motivo, $userId);

            DB::commit();

            return $mezcla->fresh();

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Revertir el ajuste de toneladas de una mezcla
     *
     * @param int $mezclaId
     * @param string $motivo - Motivo de la reversión
     * @param int $userId - ID del usuario que revierte
     * @return Mezcla
     * @throws Exception
     */
    public function revertirAjusteToneladas($mezclaId, $motivo, $userId = null)
    {
        DB::beginTransaction();

        try {
            $mezcla = Mezcla::findOrFail($mezclaId);

            // Revertir el ajuste usando el método del modelo
            $mezcla->revertirAjuste($motivo, $userId);

            DB::commit();

            return $mezcla->fresh();

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
