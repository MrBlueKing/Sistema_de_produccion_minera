<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->unsignedBigInteger('id_faena')->nullable()->after('id');
            $table->index('id_faena');
        });

        // Backfill: heredar de primera camionada
        DB::statement("
            UPDATE lotes l
            INNER JOIN (
                SELECT c.lote_id, MIN(c.id_faena) as id_faena
                FROM camionadas c
                WHERE c.id_faena IS NOT NULL
                GROUP BY c.lote_id
            ) AS primera_camionada ON l.id = primera_camionada.lote_id
            SET l.id_faena = primera_camionada.id_faena
            WHERE l.id_faena IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->dropIndex(['id_faena']);
            $table->dropColumn('id_faena');
        });
    }
};
