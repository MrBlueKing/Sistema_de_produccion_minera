<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Models\Laboratorio\Mezcla;

/**
 * Corrige el bug del importador de mezclas (Catemu insoluble/soluble) que guardaba
 * ley_visual y ley_lote intercambiadas (mapeo de columnas del Excel invertido en
 * ImportarMezclasView.jsx::detectarMapeoLeyes). Los datos ya estaban correctos,
 * solo en la columna equivocada: esto los intercambia de vuelta y recalcula
 * los promedios de la mezcla con Mezcla::calcularTotales().
 */
return new class extends Migration
{
    public function up(): void
    {
        $expresionLoteCalculado = "
            ROUND(
                LEAST(
                    CASE m.ley_base
                        WHEN 'cu_soluble' THEN d.cu_soluble
                        WHEN 'cu_total' THEN d.ley
                        WHEN 'cu_insoluble' THEN d.cu_insoluble
                        ELSE GREATEST(COALESCE(d.cu_insoluble,0), COALESCE(d.cu_soluble,0))
                    END,
                3.70) * 0.81
            , 2)
        ";

        $filasAfectadas = DB::table('mezcla_dumpada as md')
            ->join('mezclas as m', 'm.id', '=', 'md.mezcla_id')
            ->join('dumpadas as d', 'd.id', '=', 'md.dumpada_id')
            ->where('md.tipo', 'DUMP')
            ->select('md.id', 'md.mezcla_id', 'md.ley_visual', 'md.ley_lote')
            ->whereRaw("ABS(({$expresionLoteCalculado}) - md.ley_visual) <= 0.01")
            ->get();

        if ($filasAfectadas->isEmpty()) {
            return;
        }

        $mezclaIds = [];

        foreach ($filasAfectadas as $fila) {
            DB::table('mezcla_dumpada')->where('id', $fila->id)->update([
                'ley_visual' => $fila->ley_lote,
                'ley_lote'   => $fila->ley_visual,
            ]);
            $mezclaIds[$fila->mezcla_id] = true;
        }

        foreach (array_keys($mezclaIds) as $mezclaId) {
            $mezcla = Mezcla::with('detalles')->find($mezclaId);
            if (!$mezcla) continue;
            $mezcla->calcularTotales();
            $mezcla->save();
        }

        \Log::info('🔧 [FIX MIGRACION] Corregido swap ley_visual/ley_lote', [
            'filas_corregidas' => $filasAfectadas->count(),
            'mezclas_recalculadas' => count($mezclaIds),
        ]);
    }

    public function down(): void
    {
        // No reversible de forma segura de manera automática (requeriría re-detectar
        // el estado "corregido" para volver a invertir). No se define down().
    }
};
