<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Corrige 45 dumpadas de Catemu (id_faena=2) cargadas con año 2025 en vez de 2026
 * (el texto libre de "acopios" también trae 2025, el error de tipeo viene del origen,
 * probablemente por seguir escribiendo el año anterior recién entrado el 2026).
 *
 * Confirmado comparando contra Catemu.xlsx: a abril-2026 le faltan exactamente 45
 * dumpadas respecto al Excel, y estas 45 no existen en el Excel bajo ningún año —
 * son las mismas, solo mal fechadas.
 */
return new class extends Migration
{
    private array $ids;

    public function __construct()
    {
        $this->ids = array_merge(range(20965, 20976), range(21188, 21220));
    }

    public function up(): void
    {
        $actualizadas = DB::table('dumpadas')
            ->whereIn('id', $this->ids)
            ->where('id_faena', 2)
            ->whereRaw('YEAR(fecha) = 2025')
            ->update([
                'fecha' => DB::raw('DATE_ADD(fecha, INTERVAL 1 YEAR)'),
            ]);

        \Log::info('🔧 [FIX FECHA DUMPADAS] Catemu abril 2025 -> 2026', [
            'esperadas' => count($this->ids),
            'actualizadas' => $actualizadas,
        ]);
    }

    public function down(): void
    {
        DB::table('dumpadas')
            ->whereIn('id', $this->ids)
            ->where('id_faena', 2)
            ->whereRaw('YEAR(fecha) = 2026')
            ->update([
                'fecha' => DB::raw('DATE_SUB(fecha, INTERVAL 1 YEAR)'),
            ]);
    }
};
