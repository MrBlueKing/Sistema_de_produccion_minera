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
        Schema::table('camionadas', function (Blueprint $table) {
            $table->unsignedBigInteger('id_faena')->nullable()->after('id');
            $table->index('id_faena');
        });

        // Backfill: heredar de mezcla
        DB::statement("
            UPDATE camionadas c
            INNER JOIN mezclas m ON c.mezcla_id = m.id
            SET c.id_faena = m.id_faena
            WHERE c.id_faena IS NULL AND m.id_faena IS NOT NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            $table->dropIndex(['id_faena']);
            $table->dropColumn('id_faena');
        });
    }
};
