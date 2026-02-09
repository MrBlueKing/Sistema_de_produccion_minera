<?php

namespace App\Services\Laboratorio;

use App\Models\Laboratorio\Mezcla;
use App\Models\Laboratorio\LoteVenta;
use App\Models\Laboratorio\MezclaDumpada;
use Illuminate\Support\Facades\DB;
use Exception;

class LoteVentaService
{
    /**
     * Crear un nuevo lote de venta a partir de una mezcla
     *
     * @param array $datos [
     *   'numero_lote' => 'L1001' (opcional, se genera automáticamente),
     *   'mezcla_id' => 1,
     *   'cliente' => 'MDF Inés',
     *   'fecha_envio' => '2025-11-17',
     *   'peso_enviado' => 80.0,
     *   'ley_lab' => 1.15 (opcional, se ingresa después),
     *   'user_id' => 1,
     *   'observaciones' => 'Texto opcional'
     * ]
     * @return LoteVenta
     * @throws Exception
     */
    public function crearLoteVenta(array $datos)
    {
        DB::beginTransaction();

        try {
            // 1. Verificar que exista la mezcla
            $mezcla = Mezcla::findOrFail($datos['mezcla_id']);

            // 2. Validar que el peso enviado no supere el total de la mezcla
            if ($datos['peso_enviado'] > $mezcla->total_ton) {
                throw new Exception("El peso enviado ({$datos['peso_enviado']} t) no puede superar el total de la mezcla ({$mezcla->total_ton} t)");
            }

            // 3. Generar número de lote si no se proporciona
            $numeroLote = $datos['numero_lote'] ?? LoteVenta::generarNumeroLote('L');

            // 4. Crear el lote de venta
            $lote = LoteVenta::create([
                'numero_lote' => $numeroLote,
                'mezcla_id' => $mezcla->id,
                'cliente' => $datos['cliente'],
                'fecha_envio' => $datos['fecha_envio'] ?? now(),
                'peso_enviado' => $datos['peso_enviado'],
                'ley_lab' => $datos['ley_lab'] ?? null,
                'user_id' => $datos['user_id'] ?? null,
                'observaciones' => $datos['observaciones'] ?? null,
                'estado' => LoteVenta::ESTADO_PREPARADO,
            ]);

            // 5. Calcular remanente automáticamente
            $lote->calcularRemanente();

            // 6. Calcular porcentaje de error si hay ley_lab
            if ($lote->ley_lab) {
                $lote->calcularPorcentajeError();
            }

            $lote->save();

            DB::commit();

            return $lote->fresh(['mezcla.detalles']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Actualizar ley de laboratorio y calcular error
     *
     * @param int $loteId
     * @param float $leyLab
     * @return LoteVenta
     */
    public function actualizarLeyLaboratorio($loteId, $leyLab)
    {
        $lote = LoteVenta::findOrFail($loteId);
        $lote->ley_lab = $leyLab;
        $lote->calcularPorcentajeError();
        $lote->estado = LoteVenta::ESTADO_COMPLETADO;
        $lote->save();

        return $lote;
    }

    /**
     * Actualizar datos del lote
     *
     * @param int $loteId
     * @param array $datos
     * @return LoteVenta
     */
    public function actualizarLote($loteId, array $datos)
    {
        DB::beginTransaction();

        try {
            $lote = LoteVenta::findOrFail($loteId);

            // Si se actualiza el peso enviado, recalcular remanente
            if (isset($datos['peso_enviado'])) {
                $mezcla = $lote->mezcla;
                if ($datos['peso_enviado'] > $mezcla->total_ton) {
                    throw new Exception("El peso enviado no puede superar el total de la mezcla");
                }
            }

            $lote->update($datos);

            // Recalcular remanente y error
            $lote->calcularRemanente();
            if ($lote->ley_lab) {
                $lote->calcularPorcentajeError();
            }
            $lote->save();

            DB::commit();

            return $lote->fresh(['mezcla']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Agregar remanente de un lote a una nueva mezcla
     *
     * @param int $loteId Lote del cual tomar el remanente
     * @param int $mezclaId Mezcla destino
     * @return MezclaDumpada
     * @throws Exception
     */
    public function agregarRemanenteAMezcla($loteId, $mezclaId)
    {
        DB::beginTransaction();

        try {
            $lote = LoteVenta::with('mezcla')->findOrFail($loteId);
            $mezclaDestino = Mezcla::findOrFail($mezclaId);

            if (!$lote->tieneRemanente()) {
                throw new Exception("El lote {$lote->numero_lote} no tiene remanente disponible");
            }

            // Verificar que el remanente no haya sido usado ya
            $yaUsado = MezclaDumpada::where('lote_venta_id', $lote->id)
                ->where('tipo', MezclaDumpada::TIPO_REMANENTE)
                ->exists();

            if ($yaUsado) {
                throw new Exception("El remanente del lote {$lote->numero_lote} ya fue utilizado en otra mezcla");
            }

            // Agregar remanente a la mezcla
            $detalle = MezclaDumpada::desdeLoteVenta($lote, $mezclaDestino->id);

            // Recalcular totales de la mezcla destino
            $mezclaDestino->calcularTotales();
            $mezclaDestino->save();

            DB::commit();

            return $detalle;

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Obtener lotes con remanente disponible
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function obtenerLotesConRemanente()
    {
        return LoteVenta::with(['mezcla'])
            ->where('peso_remanente', '>', 0)
            ->whereDoesntHave('remanentesMezclas') // No usados aún
            ->orderBy('fecha_envio', 'desc')
            ->get();
    }

    /**
     * Generar reporte de un lote de venta
     *
     * @param int $loteId
     * @return array
     */
    public function generarReporte($loteId)
    {
        $lote = LoteVenta::with(['mezcla.detalles.dumpada'])->findOrFail($loteId);

        return [
            'lote' => [
                'numero_lote' => $lote->numero_lote,
                'cliente' => $lote->cliente,
                'fecha_envio' => $lote->fecha_envio->format('d-m-Y'),
                'estado' => $lote->estado,
            ],
            'mezcla_origen' => [
                'codigo' => $lote->mezcla->codigo,
                'total_ton' => $lote->mezcla->total_ton,
                'ley_prom_dump' => $lote->mezcla->ley_prom_dump,
            ],
            'envio' => [
                'peso_enviado' => $lote->peso_enviado,
                'ley_lab' => $lote->ley_lab,
                'porcentaje_error' => $lote->porcentaje_error,
            ],
            'remanente' => [
                'peso_remanente' => $lote->peso_remanente,
                'tiene_remanente' => $lote->tieneRemanente(),
                'usado' => $lote->remanentesMezclas()->exists(),
            ],
            'observaciones' => $lote->observaciones,
        ];
    }
}
