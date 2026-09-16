<?php

namespace App\Observers;

use App\Models\Laboratorio\Camionada;
use App\Models\Laboratorio\Mezcla;
use Illuminate\Support\Facades\Log;

class MezclaObserver
{
    /**
     * Campos que, al cambiar, invalidan el ley_mezcla/ley_visual "congelado" que quedó
     * guardado en las camionadas despachadas con esta mezcla — típicamente porque
     * Laboratorio actualizó una dumpada después de armada la mezcla (ver DumpadaObserver)
     * y ese recálculo de la mezcla se propaga hacia las camionadas que la usan.
     */
    private const CAMPOS_QUE_AFECTAN_LEY = ['ley_prom_lote', 'ley_prom_visual'];

    public function updated(Mezcla $mezcla): void
    {
        if (!$mezcla->wasChanged(self::CAMPOS_QUE_AFECTAN_LEY)) {
            return;
        }

        $camionadas = Camionada::whereHas('mezclas', fn ($q) => $q->where('mezclas.id', $mezcla->id))->get();

        if ($camionadas->isEmpty()) {
            return;
        }

        $camionadaIdsActualizadas = [];

        foreach ($camionadas as $camionada) {
            if ($camionada->refrescarLeyDesdeMezclas()) {
                $camionadaIdsActualizadas[] = $camionada->id;
            }
        }

        if (empty($camionadaIdsActualizadas)) {
            return;
        }

        Log::info('🔄 [CAMIONADA] Recalculando ley_mezcla por actualización de mezcla', [
            'mezcla_id' => $mezcla->id,
            'codigo' => $mezcla->codigo,
            'camionadas_actualizadas' => $camionadaIdsActualizadas,
        ]);
    }
}
