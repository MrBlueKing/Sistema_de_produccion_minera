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
        if (!Schema::hasColumn('tronaduras', 'id_faena')) {
            Schema::table('tronaduras', function (Blueprint $table) {
                $table->unsignedBigInteger('id_faena')->nullable()->after('id');
                $table->index('id_faena');
            });
        }

        // Backfill: heredar de frente_trabajo
        DB::statement("
            UPDATE tronaduras t
            INNER JOIN frentes_trabajo f ON t.id_frente_trabajo = f.id
            SET t.id_faena = f.id_faena
            WHERE t.id_faena IS NULL AND f.id_faena IS NOT NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('tronaduras', 'id_faena')) {
            Schema::table('tronaduras', function (Blueprint $table) {
                $table->dropIndex(['id_faena']);
                $table->dropColumn('id_faena');
            });
        }
    }
};
