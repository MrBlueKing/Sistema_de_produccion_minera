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
        Schema::table('acopios', function (Blueprint $table) {
            $table->unsignedBigInteger('id_faena')->nullable()->after('id');
            $table->index('id_faena');
        });

        // Backfill: heredar de frente_trabajo
        DB::statement("
            UPDATE acopios a
            INNER JOIN frentes_trabajo f ON a.id_frente_trabajo = f.id
            SET a.id_faena = f.id_faena
            WHERE a.id_faena IS NULL AND f.id_faena IS NOT NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('acopios', function (Blueprint $table) {
            $table->dropIndex(['id_faena']);
            $table->dropColumn('id_faena');
        });
    }
};
