<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Completa ley_visual en dumpadas donde nunca se cargó una estimación real
 * (quedó en 0 por defecto). Regla de negocio confirmada con el usuario:
 *
 * 1) Si el Excel de origen SÍ tiene una Ley Visual cargada para esa dumpada
 *    (17 casos detectados donde la BD tenía un valor viejo/distinto), se usa
 *    el valor del Excel.
 * 2) Si el Excel NO tiene Ley Visual para esa dumpada, se usa el promedio de
 *    Ley de laboratorio ("ley", no "ley_visual") de TODAS las dumpadas del
 *    mismo frente + fecha + jornada (nunca se mezcla con otra fecha/grupo).
 *
 * Dumpadas sin resultado de laboratorio (ley NULL, muy recientes, fin de
 * julio-2026 en adelante) quedan fuera de esta migración a propósito.
 *
 * Los valores ya vienen precalculados en el fixture JSON adjunto (calculado
 * cruzando la BD contra Cabildo.xlsx / Catemu.xlsx), porque una migración en
 * el servidor de producción no tiene forma de leer los Excel de origen.
 */
return new class extends Migration
{
    public function up(): void
    {
        $path = __DIR__ . '/fixtures/ley_visual_backfill_2026_07_30.json';

        if (!file_exists($path)) {
            \Log::warning('🔧 [FIX LEY VISUAL FALTANTE] Fixture no encontrado, migración omitida', ['path' => $path]);
            return;
        }

        $filas = json_decode(file_get_contents($path), true);

        $actualizadas = 0;

        foreach (array_chunk($filas, 500) as $lote) {
            $casos = [];
            $ids = [];
            foreach ($lote as $fila) {
                $id = (int) $fila['id'];
                $valor = (float) $fila['ley_visual'];
                $casos[] = "WHEN {$id} THEN {$valor}";
                $ids[] = $id;
            }

            $casosSql = implode(' ', $casos);
            $idsSql = implode(',', $ids);

            DB::statement("UPDATE dumpadas SET ley_visual = CASE id {$casosSql} END WHERE id IN ({$idsSql})");
            $actualizadas += count($lote);
        }

        \Log::info('🔧 [FIX LEY VISUAL FALTANTE] Dumpadas actualizadas', ['cantidad' => $actualizadas]);
    }

    public function down(): void
    {
        // No reversible de forma segura de manera automática.
    }
};
