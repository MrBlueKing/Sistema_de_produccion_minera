<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Corrige 28 dumpadas de Cabildo (numero_dumpada 6392 a 6419) con fecha
 * 08-01-2025 cuando debia ser 08-01-2026 (año mal tipeado al ingresar, mismo
 * tipo de error ya visto en Catemu-abril). Confirmado porque la dumpada
 * anterior (6391) es del 07-01-2026 y la siguiente (6420) es del 09-01-2026 -
 * quedan justo en medio de la secuencia de esas fechas.
 *
 * El Excel de origen (Cabildo.xlsx) ya fue corregido manualmente por el
 * usuario; esta migracion alinea la BD con esa correccion.
 */
return new class extends Migration
{
    public function up(): void
    {
        $actualizadas = DB::table('dumpadas')
            ->where('id_faena', 1)
            ->whereBetween('numero_dumpada', ['6392', '6419'])
            ->whereDate('fecha', '2025-01-08')
            ->update(['fecha' => '2026-01-08']);

        \Log::info('🔧 [FIX FECHA DUMPADAS CABILDO ENERO] Dumpadas corregidas', ['cantidad' => $actualizadas]);
    }

    public function down(): void
    {
        DB::table('dumpadas')
            ->where('id_faena', 1)
            ->whereBetween('numero_dumpada', ['6392', '6419'])
            ->whereDate('fecha', '2026-01-08')
            ->update(['fecha' => '2025-01-08']);
    }
};
