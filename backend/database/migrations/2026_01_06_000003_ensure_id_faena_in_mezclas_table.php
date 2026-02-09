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
        // Verificar si la columna ya existe
        if (!Schema::hasColumn('mezclas', 'id_faena')) {
            Schema::table('mezclas', function (Blueprint $table) {
                $table->unsignedBigInteger('id_faena')->nullable()->after('id');
                $table->index('id_faena');
            });
        }

        // Backfill: heredar de dumpadas en mezcla_dumpada
        DB::statement("
            UPDATE mezclas m
            INNER JOIN (
                SELECT md.mezcla_id, MIN(d.id_faena) as id_faena
                FROM mezcla_dumpada md
                INNER JOIN dumpadas d ON md.dumpada_id = d.id
                WHERE d.id_faena IS NOT NULL
                GROUP BY md.mezcla_id
            ) AS primera_dumpada ON m.id = primera_dumpada.mezcla_id
            SET m.id_faena = primera_dumpada.id_faena
            WHERE m.id_faena IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('mezclas', 'id_faena')) {
            Schema::table('mezclas', function (Blueprint $table) {
                $table->dropIndex(['id_faena']);
                $table->dropColumn('id_faena');
            });
        }
    }
};
