<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * camionadas.id_faena quedaba NULL cuando la camionada se creaba desde la app
     * (CamionadaService::crearCamionada nunca lo copiaba del lote) — solo las
     * importadas desde Excel lo tenían. lotes.id_faena nunca es NULL, así que es
     * la fuente confiable para corregir el histórico.
     */
    public function up(): void
    {
        DB::statement(<<<SQL
            UPDATE camionadas
            JOIN lotes ON lotes.id = camionadas.lote_id
            SET camionadas.id_faena = lotes.id_faena
            WHERE camionadas.id_faena IS NULL
        SQL);
    }

    public function down(): void
    {
        // Backfill de datos, no se revierte.
    }
};
