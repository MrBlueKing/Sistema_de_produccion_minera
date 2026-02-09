<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Config\MezclaConfig;

/**
 * Migración para revertir el factor de ajuste en mezclas existentes
 *
 * CONTEXTO:
 * - Sistema anterior: guardaba leyes CON factor 0.9 aplicado en mezcla_dumpada
 * - Sistema nuevo: guarda leyes ORIGINALES y aplica factor 0.9 solo al calcular promedios
 *
 * Esta migración convierte las mezclas existentes al nuevo formato:
 * 1. Revierte factor 0.9 en leyes de mezcla_dumpada (divide entre 0.9)
 * 2. Recalcula los promedios de todas las mezclas con el nuevo método
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $factor = MezclaConfig::getFactorAjusteLey(); // 0.9

        echo "\n🔄 Actualizando mezclas existentes al nuevo formato...\n";

        // 1. Revertir factor en registros de mezcla_dumpada tipo DUMP (dumpadas)
        // Las dumpadas tienen leyes CON factor aplicado, necesitamos dividir entre 0.9
        $dumpadasActualizadas = DB::table('mezcla_dumpada')
            ->where('tipo', 'DUMP')
            ->whereNotNull('ley_dump_ajustada')
            ->update([
                'ley_dump_ajustada' => DB::raw("ROUND(ley_dump_ajustada / {$factor}, 2)"),
                'ley_visual' => DB::raw("ROUND(COALESCE(ley_visual, 0) / {$factor}, 2)"),
                'ley_lote' => DB::raw("ROUND(COALESCE(ley_lote, 0) / {$factor}, 2)"),
            ]);

        echo "✅ {$dumpadasActualizadas} dumpadas actualizadas (leyes revertidas)\n";

        // 2. Los remanentes también necesitan revertirse si vienen de mezclas antiguas
        // Pero solo los que NO son NULL
        $remanentesActualizados = DB::table('mezcla_dumpada')
            ->where('tipo', 'REM')
            ->whereNotNull('ley_dump_ajustada')
            ->update([
                'ley_dump_ajustada' => DB::raw("ROUND(ley_dump_ajustada / {$factor}, 2)"),
                'ley_visual' => DB::raw("ROUND(COALESCE(ley_visual, 0) / {$factor}, 2)"),
                'ley_lote' => DB::raw("ROUND(COALESCE(ley_lote, 0) / {$factor}, 2)"),
            ]);

        echo "✅ {$remanentesActualizados} remanentes actualizados (leyes revertidas)\n";

        // 3. Recalcular totales de todas las mezclas con el nuevo método
        $mezclas = DB::table('mezclas')->get();

        foreach ($mezclas as $mezclaData) {
            $mezcla = \App\Models\Laboratorio\Mezcla::find($mezclaData->id);
            if ($mezcla) {
                $mezcla->calcularTotales();
                $mezcla->save();
            }
        }

        echo "✅ {$mezclas->count()} mezclas recalculadas con nuevo método\n";
        echo "🎉 Migración completada exitosamente!\n\n";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $factor = MezclaConfig::getFactorAjusteLey(); // 0.9

        echo "\n⏪ Revirtiendo cambios...\n";

        // Volver a aplicar el factor (multiplicar por 0.9)
        DB::table('mezcla_dumpada')
            ->whereNotNull('ley_dump_ajustada')
            ->update([
                'ley_dump_ajustada' => DB::raw("ROUND(ley_dump_ajustada * {$factor}, 2)"),
                'ley_visual' => DB::raw("ROUND(COALESCE(ley_visual, 0) * {$factor}, 2)"),
                'ley_lote' => DB::raw("ROUND(COALESCE(ley_lote, 0) * {$factor}, 2)"),
            ]);

        // Recalcular mezclas con método antiguo
        $mezclas = DB::table('mezclas')->get();
        foreach ($mezclas as $mezclaData) {
            $mezcla = \App\Models\Laboratorio\Mezcla::find($mezclaData->id);
            if ($mezcla) {
                $mezcla->calcularTotales();
                $mezcla->save();
            }
        }

        echo "✅ Cambios revertidos\n\n";
    }
};
