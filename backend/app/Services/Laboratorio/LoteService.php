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
            // numero_lote se asigna al recepcionar la primera camionada.
            // Planta y empresa son opcionales: un lote puede abrirse sin
            // saber alguna, o ninguna, todavía -- se completan después
            // editando el mismo lote.
            $lote = Lote::create([
                'numero_lote' => $datos['numero_lote'] ?? null,
                'planta_id' => $datos['planta_id'] ?? null,
                'empresa_id' => $datos['empresa_id'] ?? null,
                'id_faena' => $datos['id_faena'] ?? null,
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
        $lote = Lote::with(['planta', 'empresa', 'camionadas.mezclas'])->findOrFail($loteId);

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

            // camionadas.planta / camionadas.cliente guardan el NOMBRE (texto) de la
            // planta/empresa del lote al crearse — si se corrige el destino del lote,
            // hay que arrastrarlo a sus camionadas o quedan mostrando el valor viejo.
            if ($lote->wasChanged('planta_id') || $lote->wasChanged('empresa_id')) {
                $lote->load(['planta', 'empresa']);
                $cambios = [];
                if ($lote->wasChanged('planta_id')) {
                    $cambios['planta'] = $lote->planta?->nombre;
                }
                if ($lote->wasChanged('empresa_id')) {
                    $cambios['cliente'] = $lote->empresa?->nombre;
                }
                $lote->camionadas()->update($cambios);
            }

            DB::commit();
            return $lote->fresh(['planta', 'empresa', 'camionadas']);

        } catch (Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
}
