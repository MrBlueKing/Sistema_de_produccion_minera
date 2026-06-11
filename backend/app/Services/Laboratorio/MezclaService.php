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

            // 2. Validar y procesar DUMPADAS INDIVIDUALES si existen
            // Acepta formato [{id, numero_paladas}] (paladas parciales o null = completa)
            $dumpadasDatos = $datos['dumpadas'] ?? [];
            $dumpadas = [];
            $dumpadasPaladasMap = []; // [id => numero_paladas|null]
            if (!empty($dumpadasDatos)) {
                // Normalizar: extraer IDs y construir mapa de paladas
                $dumpadasIds = array_map(fn($d) => is_array($d) ? $d['id'] : (int)$d, $dumpadasDatos);
                foreach ($dumpadasDatos as $dd) {
                    if (is_array($dd)) {
                        $dumpadasPaladasMap[$dd['id']] = isset($dd['numero_paladas']) ? (float)$dd['numero_paladas'] : null;
                    } else {
                        $dumpadasPaladasMap[(int)$dd] = null; // backward compat: sin paladas = completa
                    }
                }

                $dumpadas = Dumpada::whereIn('id', $dumpadasIds)->get();

                if ($dumpadas->count() !== count($dumpadasIds)) {
                    throw new Exception('Algunas dumpadas no existen');
                }

                // Verificar que las dumpadas no estén en otra mezcla
                foreach ($dumpadas as $dumpada) {
                    $numeroPaladas = $dumpadasPaladasMap[$dumpada->id] ?? null;

                    if ($numeroPaladas === null) {
                        // Dumpada completa: no puede estar en ninguna mezcla ni tener usos parciales
                        if ($dumpada->estaEnMezcla()) {
                            throw new Exception("La dumpada #{$dumpada->numero_dumpada} ya está en una mezcla");
                        }
                        if ($dumpada->tieneUsosParciales()) {
                            throw new Exception("La dumpada #{$dumpada->numero_dumpada} tiene uso parcial en otras mezclas. Use el modo de paladas para agregar el resto.");
                        }
                    } else {
                        // Uso parcial: verificar que no esté completa ya y que haya paladas disponibles
                        if ($dumpada->estaEnMezcla()) {
                            throw new Exception("La dumpada #{$dumpada->numero_dumpada} ya está asignada completa en otra mezcla");
                        }
                        $tonPorPalada = (float) \App\Models\ConfiguracionSistema::obtener('toneladas_por_palada', 1.82, $dumpada->id_faena);
                        $paladasDisponibles = $dumpada->getPaladasDisponibles($tonPorPalada);
                        if ($numeroPaladas > $paladasDisponibles) {
                            throw new Exception("La dumpada #{$dumpada->numero_dumpada} solo tiene {$paladasDisponibles} paladas disponibles, solicitadas: {$numeroPaladas}");
                        }
                    }

                    // Verificar que la dumpada no esté en un acopio
                    if ($dumpada->estaEnAcopio()) {
                        throw new Exception("La dumpada #{$dumpada->numero_dumpada} está en un acopio. Debe usar el acopio completo.");
                    }
                }
            }

            // Validar que al menos haya acopios, dumpadas o remanentes
            $tieneRemanentes = !empty($datos['remanentes_mezclas']) || !empty($datos['remanentes_manuales']) || !empty($datos['lotes_venta_remanentes']);
            if (empty($acopiosIds) && empty($dumpadasDatos) && !$tieneRemanentes) {
                throw new Exception('Debe proporcionar al menos un acopio, dumpadas individuales o remanentes');
            }

            // 3. Generar código si no se proporciona (usa el prefijo de la planta)
            $plantaId = $datos['planta_id'] ?? null;
            $codigo = $datos['codigo'] ?? Mezcla::generarCodigo($plantaId);

            // 4. Crear la mezcla
            $leyBase = $datos['ley_base'] ?? 'auto';

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
                'ley_base' => $leyBase,
            ]);

            // 5. Agregar dumpadas desde ACOPIOS
            foreach ($acopios as $acopio) {
                // Obtener todas las dumpadas del acopio
                $dumpadasDelAcopio = $acopio->dumpadas;

                foreach ($dumpadasDelAcopio as $dumpada) {
                    MezclaDumpada::desdeDumpada($dumpada, $mezcla->id, null, $leyBase);
                }

                // Marcar el acopio como EN_MEZCLA
                $acopio->update(['estado' => Acopio::ESTADO_EN_MEZCLA]);
            }

            // 6. Agregar dumpadas individuales si existen (con soporte de paladas parciales)
            foreach ($dumpadas as $dumpada) {
                $numeroPaladas = $dumpadasPaladasMap[$dumpada->id] ?? null;
                MezclaDumpada::desdeDumpada($dumpada, $mezcla->id, $numeroPaladas, $leyBase);
            }

            // 7. Agregar remanentes de mezclas existentes si existen
            if (isset($datos['remanentes_mezclas']) && is_array($datos['remanentes_mezclas'])) {
                foreach ($datos['remanentes_mezclas'] as $remanente) {
                    $mezclaOrigen = Mezcla::find($remanente['mezcla_id']);

                    if (!$mezclaOrigen) {
                        throw new Exception("Mezcla origen #{$remanente['mezcla_id']} no encontrada");
                    }

                    $factorRemanenteVisual = \App\Config\MezclaConfig::getFactorRemanenteVisual();

                    // ley_dump: usar directo (ya tiene factores aplicados)
                    $leyDumpRemanente  = $mezclaOrigen->ley_prom_dump;
                    $leyLoteRemanente  = $mezclaOrigen->ley_prom_lote;
                    $leyVisualRemanente = $mezclaOrigen->ley_prom_lote
                        ? round($mezclaOrigen->ley_prom_lote * $factorRemanenteVisual, 2)
                        : null;

                    // MODO PALADAS: numero_paladas provisto → estimar toneladas
                    if (isset($remanente['numero_paladas']) && $remanente['numero_paladas'] > 0) {
                        $tonPorPalada = (float) \App\Models\ConfiguracionSistema::obtener('toneladas_por_palada', 1.82, $datos['id_faena'] ?? null);
                        $toneladasEstimadas   = round($remanente['numero_paladas'] * $tonPorPalada, 2);
                        $toneladasRealesOrigen = (float) $mezclaOrigen->toneladas_disponibles;

                        \Log::info('🔄 [REMANENTE-PALADAS] Agregando remanente por paladas', [
                            'mezcla_origen'         => $mezclaOrigen->codigo,
                            'numero_paladas'         => $remanente['numero_paladas'],
                            'ton_por_palada'         => $tonPorPalada,
                            'toneladas_estimadas'    => $toneladasEstimadas,
                            'toneladas_reales_origen' => $toneladasRealesOrigen,
                            'delta'                  => $toneladasEstimadas - $toneladasRealesOrigen,
                        ]);

                        MezclaDumpada::create([
                            'mezcla_id'              => $mezcla->id,
                            'dumpada_id'             => null,
                            'tipo'                   => MezclaDumpada::TIPO_REMANENTE,
                            'origen'                 => "Remanente de {$mezclaOrigen->codigo}",
                            'toneladas'              => $toneladasEstimadas,
                            'numero_paladas'         => $remanente['numero_paladas'],
                            'toneladas_reales_origen' => $toneladasRealesOrigen,
                            'ley_dump_ajustada'      => $leyDumpRemanente,
                            'ley_visual'             => $leyVisualRemanente,
                            'ley_lote'               => $leyLoteRemanente,
                        ]);

                        // Descontar las toneladas reales disponibles (lo que había registrado)
                        $mezclaOrigen->descontarToneladas($toneladasRealesOrigen);

                    } else {
                        // MODO TONELADAS: validar y descontar como antes
                        $toneladasUsar = $remanente['toneladas'];

                        if ($toneladasUsar > $mezclaOrigen->toneladas_disponibles) {
                            throw new Exception("La mezcla {$mezclaOrigen->codigo} solo tiene {$mezclaOrigen->toneladas_disponibles} ton disponibles, solicitadas: {$toneladasUsar} ton");
                        }

                        \Log::info('🔄 [REMANENTE] Agregando remanente a mezcla', [
                            'mezcla_origen'         => $mezclaOrigen->codigo,
                            'toneladas_usar'        => $toneladasUsar,
                            'ley_prom_dump_origen'  => $mezclaOrigen->ley_prom_dump,
                            'ley_prom_lote_origen'  => $mezclaOrigen->ley_prom_lote,
                        ]);

                        MezclaDumpada::create([
                            'mezcla_id'      => $mezcla->id,
                            'dumpada_id'     => null,
                            'tipo'           => MezclaDumpada::TIPO_REMANENTE,
                            'origen'         => "Remanente de {$mezclaOrigen->codigo}",
                            'toneladas'      => $toneladasUsar,
                            'ley_dump_ajustada' => $leyDumpRemanente,
                            'ley_visual'     => $leyVisualRemanente,
                            'ley_lote'       => $leyLoteRemanente,
                        ]);

                        $mezclaOrigen->descontarToneladas($toneladasUsar);
                    }
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
     * Agregar dumpadas adicionales a una mezcla existente.
     * Soporta dumpadas completas y uso parcial por paladas.
     *
     * @param int $mezclaId
     * @param array $dumpadas Array de objetos: [{id: int, numero_paladas: float|null}, ...]
     *                        numero_paladas = null → dumpada completa (comportamiento legado)
     *                        numero_paladas > 0   → solo esas paladas de la dumpada
     * @return Mezcla
     * @throws Exception
     */
    public function agregarDumpadas($mezclaId, array $dumpadas)
    {
        DB::beginTransaction();

        try {
            $mezcla = Mezcla::findOrFail($mezclaId);

            // Validar que no tenga ajuste aplicado
            if ($mezcla->ajuste_aplicado) {
                throw new Exception('No se pueden agregar dumpadas a una mezcla con ajuste de toneladas aplicado');
            }

            // Obtener configuración de toneladas por palada
            $tonPorPalada = (float) \App\Models\ConfiguracionSistema::obtener('toneladas_por_palada', 1.82);

            foreach ($dumpadas as $dumpadaData) {
                // Normalizar: aceptar int (legado) u objeto {id, numero_paladas}
                if (is_int($dumpadaData) || is_numeric($dumpadaData)) {
                    $dumpadaId = (int) $dumpadaData;
                    $numeroPaladas = null;
                } else {
                    $dumpadaId = (int) ($dumpadaData['id'] ?? 0);
                    $numeroPaladas = isset($dumpadaData['numero_paladas']) && $dumpadaData['numero_paladas'] !== null
                        ? (float) $dumpadaData['numero_paladas']
                        : null;
                }

                $dumpada = Dumpada::find($dumpadaId);
                if (!$dumpada) {
                    throw new Exception("La dumpada #{$dumpadaId} no existe");
                }

                if ($numeroPaladas !== null) {
                    // MODO PALADAS PARCIALES
                    if ($numeroPaladas <= 0) {
                        throw new Exception("El número de paladas debe ser mayor a 0 para la dumpada #{$dumpada->numero_dumpada}");
                    }

                    // No puede estar como dumpada completa en ninguna mezcla
                    if ($dumpada->estaEnMezcla()) {
                        throw new Exception("La dumpada #{$dumpada->numero_dumpada} ya está incluida como dumpada completa en una mezcla");
                    }

                    // Verificar que hay suficientes paladas disponibles
                    $paladasDisponibles = $dumpada->getPaladasDisponibles($tonPorPalada);
                    if ($numeroPaladas > $paladasDisponibles) {
                        throw new Exception("La dumpada #{$dumpada->numero_dumpada} solo tiene {$paladasDisponibles} paladas disponibles, se solicitaron {$numeroPaladas}");
                    }

                    MezclaDumpada::desdeDumpada($dumpada, $mezcla->id, $numeroPaladas, $mezcla->ley_base);

                } else {
                    // MODO DUMPADA COMPLETA (comportamiento legado)
                    if ($dumpada->estaEnMezcla()) {
                        throw new Exception("La dumpada #{$dumpada->numero_dumpada} ya está en una mezcla");
                    }

                    if ($dumpada->tieneUsosParciales()) {
                        throw new Exception("La dumpada #{$dumpada->numero_dumpada} tiene uso parcial en otras mezclas. Especifique el número de paladas restantes.");
                    }

                    MezclaDumpada::desdeDumpada($dumpada, $mezcla->id, null, $mezcla->ley_base);
                }
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
     * Obtener todas las dumpadas disponibles para agregar a mezclas.
     * Incluye dumpadas con uso parcial (paladas restantes > 0).
     *
     * Una dumpada es "disponible" cuando:
     *   1. No tiene ningún registro en mezcla_dumpada (completamente libre), O
     *   2. Solo tiene registros parciales (numero_paladas NOT NULL) y le quedan paladas
     *
     * Cada dumpada devuelta incluye:
     *   - paladas_totales: floor(ton / ton_por_palada)
     *   - paladas_usadas: suma de paladas ya asignadas a mezclas
     *   - paladas_disponibles: paladas_totales - paladas_usadas
     *   - ton_por_palada: configuración del sistema
     *   - tiene_uso_parcial: true si ya tiene alguna palada en otra mezcla
     *
     * @param array $filtros ['fecha_desde' => ..., 'fecha_hasta' => ..., 'id_faena' => ...]
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function obtenerDumpadasDisponibles(array $filtros = [])
    {
        Log::info('🔎 [SERVICE] Buscando dumpadas disponibles (con soporte de paladas)', [
            'filtros' => $filtros
        ]);

        // Obtener configuración de toneladas por palada
        $idFaena = $filtros['id_faena'] ?? null;
        $tonPorPalada = (float) \App\Models\ConfiguracionSistema::obtener('toneladas_por_palada', 1.82, $idFaena);

        // Dumpadas disponibles = las que tienen ley o ley_visual Y no están completamente usadas
        // Condición: sin registros en mezcla_dumpada, O solo con registros parciales y paladas restantes
        $query = Dumpada::where(function($q) use ($tonPorPalada) {
            // Condición 1: Sin ningún registro en mezcla_dumpada (completamente libre)
            $q->whereDoesntHave('mezclaDumpadas')
            // Condición 2: Tiene solo registros parciales (sin null) y le quedan paladas
            ->orWhere(function($q2) use ($tonPorPalada) {
                $q2->whereDoesntHave('mezclaDumpadas', function($sub) {
                        // Excluir dumpadas que tienen registro de dumpada COMPLETA (null)
                        $sub->whereNull('numero_paladas');
                    })
                    ->whereHas('mezclaDumpadas', function($sub) {
                        $sub->whereNotNull('numero_paladas');
                    })
                    ->whereRaw(
                        '(SELECT COALESCE(SUM(md.numero_paladas), 0) FROM mezcla_dumpada md WHERE md.dumpada_id = dumpadas.id AND md.numero_paladas IS NOT NULL) < FLOOR(dumpadas.ton / ?)',
                        [$tonPorPalada]
                    );
            });
        })->where(function($q) {
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
            $idsFaena = is_string($filtros['id_faena'])
                ? explode(',', $filtros['id_faena'])
                : (array) $filtros['id_faena'];
            $idsFaena = array_filter(array_map('intval', $idsFaena));

            if (count($idsFaena) === 1) {
                $query->where('id_faena', $idsFaena[0]);
            } elseif (count($idsFaena) > 1) {
                $query->whereIn('id_faena', $idsFaena);
            }
        }

        $dumpadas = $query->with(['frenteTrabajo:id,codigo_completo'])
            ->select(['id', 'numero_dumpada', 'acopios', 'fecha', 'ton', 'ley', 'ley_visual', 'cu_soluble', 'cu_insoluble', 'jornada', 'id_frente_trabajo', 'estado', 'id_faena'])
            ->orderByRaw('DATE(fecha) DESC, CAST(numero_dumpada AS UNSIGNED) DESC')
            ->get();

        // Obtener suma de paladas usadas para todas las dumpadas en un solo query
        $dumpadasIds = $dumpadas->pluck('id')->toArray();
        $paladasUsadasMap = [];
        if (!empty($dumpadasIds)) {
            $paladasUsadasMap = MezclaDumpada::whereIn('dumpada_id', $dumpadasIds)
                ->whereNotNull('numero_paladas')
                ->groupBy('dumpada_id')
                ->selectRaw('dumpada_id, SUM(numero_paladas) as total_usadas')
                ->pluck('total_usadas', 'dumpada_id')
                ->toArray();
        }

        // Agregar info de paladas a cada dumpada
        $dumpadas->each(function($dumpada) use ($tonPorPalada, $paladasUsadasMap) {
            $paladasTotales = $tonPorPalada > 0 ? (int) floor($dumpada->ton / $tonPorPalada) : 0;
            $paladasUsadas = (float) ($paladasUsadasMap[$dumpada->id] ?? 0);
            $dumpada->paladas_totales = $paladasTotales;
            $dumpada->paladas_usadas = $paladasUsadas;
            $dumpada->paladas_disponibles = max(0, $paladasTotales - $paladasUsadas);
            $dumpada->ton_por_palada = $tonPorPalada;
            $dumpada->tiene_uso_parcial = $paladasUsadas > 0;
        });

        Log::info('✅ [SERVICE] Dumpadas disponibles encontradas', [
            'total' => $dumpadas->count(),
            'completamente_libres' => $dumpadas->where('tiene_uso_parcial', false)->count(),
            'con_uso_parcial' => $dumpadas->where('tiene_uso_parcial', true)->count(),
            'ton_por_palada' => $tonPorPalada,
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
