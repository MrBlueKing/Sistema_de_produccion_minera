<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Hacer lote_id obligatorio - todas las camionadas DEBEN tener un lote asignado
     */
    public function up(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            // Primero eliminar la constraint existente
            $table->dropForeign(['lote_id']);

            // Cambiar lote_id de nullable a NOT NULL
            $table->unsignedBigInteger('lote_id')->nullable(false)->change();

            // Recrear la foreign key con restrict (no permite eliminar lote si tiene camionadas)
            $table->foreign('lote_id')
                ->references('id')
                ->on('lotes')
                ->onDelete('restrict');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            // Eliminar constraint
            $table->dropForeign(['lote_id']);

            // Volver a nullable
            $table->unsignedBigInteger('lote_id')->nullable()->change();

            // Recrear foreign key con set null
            $table->foreign('lote_id')
                ->references('id')
                ->on('lotes')
                ->onDelete('set null');
        });
    }
};
