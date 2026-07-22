<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Corrige los numero_camionada duplicados dentro de un mismo lote (bug de
     * carrera en CamionadaService::crearCamionada, sin lock) y agrega el
     * índice único que faltaba para que no pueda volver a ocurrir.
     */
    public function up(): void
    {
        // 1. Renumerar duplicados: por cada grupo (lote_id, numero_camionada)
        // con más de una fila, se deja la más antigua (id asc) con su número
        // y las demás se renumeran al siguiente número libre del lote.
        $grupos = DB::table('camionadas')
            ->select('lote_id', 'numero_camionada', DB::raw('COUNT(*) as c'))
            ->groupBy('lote_id', 'numero_camionada')
            ->having('c', '>', 1)
            ->get();

        $loteIds = $grupos->pluck('lote_id')->unique();

        foreach ($loteIds as $loteId) {
            $maxActual = (int) DB::table('camionadas')
                ->where('lote_id', $loteId)
                ->max('numero_camionada');

            $siguienteLibre = $maxActual + 1;

            $gruposDelLote = $grupos->where('lote_id', $loteId);

            foreach ($gruposDelLote as $grupo) {
                $filas = DB::table('camionadas')
                    ->where('lote_id', $loteId)
                    ->where('numero_camionada', $grupo->numero_camionada)
                    ->orderBy('id', 'asc')
                    ->get();

                // La primera (más antigua) conserva su número, el resto se renumera
                foreach ($filas->slice(1) as $fila) {
                    DB::table('camionadas')
                        ->where('id', $fila->id)
                        ->update(['numero_camionada' => $siguienteLibre]);

                    $siguienteLibre++;
                }
            }
        }

        // 2. Índice único definitivo sobre (lote_id, numero_camionada)
        Schema::table('camionadas', function (Blueprint $table) {
            $table->unique(['lote_id', 'numero_camionada'], 'camionadas_lote_numero_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            $table->dropUnique('camionadas_lote_numero_unique');
        });
    }
};
