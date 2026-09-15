<?php

namespace App\Observers;

use App\Models\Dispatch\Dumpada;
use App\Models\Laboratorio\Mezcla;
use App\Models\Laboratorio\MezclaDumpada;
use Illuminate\Support\Facades\Log;

class DumpadaObserver
{
    /**
     * Campos que, al cambiar, invalidan la ley "congelada" que quedó guardada en
     * mezcla_dumpada cuando esta dumpada se agregó a una mezcla — típicamente porque
     * Laboratorio recién ahora carga el resultado real (antes solo había ley visual).
     */
    private const CAMPOS_QUE_AFECTAN_LEY = ['ley', 'cu_soluble', 'cu_insoluble', 'ley_visual'];

    public function updated(Dumpada $dumpada): void
    {
        if (!$dumpada->wasChanged(self::CAMPOS_QUE_AFECTAN_LEY)) {
            return;
        }

        $detalles = MezclaDumpada::soloDumpadas()
            ->where('dumpada_id', $dumpada->id)
            ->get();

        if ($detalles->isEmpty()) {
            return;
        }

        $mezclaIdsAfectadas = [];

        foreach ($detalles as $detalle) {
            if ($detalle->refrescarDesdeDumpada()) {
                $mezclaIdsAfectadas[] = $detalle->mezcla_id;
            }
        }

        if (empty($mezclaIdsAfectadas)) {
            return;
        }

        Log::info('🔄 [MEZCLA] Recalculando mezclas por actualización de dumpada', [
            'dumpada_id' => $dumpada->id,
            'numero_dumpada' => $dumpada->numero_dumpada,
            'mezclas_afectadas' => array_unique($mezclaIdsAfectadas),
        ]);

        foreach (array_unique($mezclaIdsAfectadas) as $mezclaId) {
            $mezcla = Mezcla::find($mezclaId);
            if (!$mezcla) {
                continue;
            }
            $mezcla->calcularTotales();
            $mezcla->save();
        }
    }
}
