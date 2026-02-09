<?php

namespace App\Services\Laboratorio;

use App\Models\Laboratorio\Lote;
use App\Models\Laboratorio\Camionada;
use Illuminate\Support\Facades\DB;
use Exception;

class LoteService
{
    /**
     * Crear un nuevo lote
     */
    public function crearLote(array $datos)
    {
        DB::beginTransaction();

        try {
            // Generar número si no viene
            if (!isset($datos['numero_lote'])) {
                $datos['numero_lote'] = Lote::generarNumeroLote(
                    $datos['planta_id'],
                    $datos['empresa_id']
                );
            }

            $lote = Lote::create([
                'numero_lote' => $datos['numero_lote'],
                'planta_id' => $datos['planta_id'],
                'empresa_id' => $datos['empresa_id'],
                'fecha_creacion' => $datos['fecha_creacion'] ?? now(),
                'fecha_estimada_llegada' => $datos['fecha_estimada_llegada'] ?? null,
                'estado' => Lote::ESTADO_ABIERTO,
                'observaciones' => $datos['observaciones'] ?? null,
                'user_id' => $datos['user_id'] ?? null,
            ]);

            DB::commit();
            return $lote->fresh(['planta', 'empresa']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Agregar camionada a un lote
     */
    public function agregarCamionada($loteId, $camionadaId)
    {
        $camionada = Camionada::findOrFail($camionadaId);
        $camionada->lote_id = $loteId;
        $camionada->save();

        return $camionada;
    }

    /**
     * Obtener resumen del lote
     */
    public function obtenerResumen($loteId)
    {
        $lote = Lote::with(['planta', 'empresa', 'camionadas.mezcla'])->findOrFail($loteId);

        return [
            'lote' => $lote,
            'numero_camionadas' => $lote->getNumeroCamionadas(),
            'peso_total' => $lote->getPesoTotal(),
            'peso_recibido' => $lote->getPesoRecibido(),
            'remanente' => $lote->getRemanente(),
            'todas_recepcionadas' => $lote->todasCamionadasRecepcionadas(),
        ];
    }

    /**
     * Actualizar lote
     */
    public function actualizarLote($loteId, array $datos)
    {
        DB::beginTransaction();

        try {
            $lote = Lote::findOrFail($loteId);
            $lote->update($datos);

            DB::commit();
            return $lote->fresh(['planta', 'camionadas']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
