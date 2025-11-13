<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('frentes_trabajo', function (Blueprint $table) {
            // Agregar campo id_faena (referencia a la tabla faena del sistema central)
            $table->unsignedBigInteger('id_faena')->nullable()->after('id');

            // Agregar campo estado (activo/inactivo)
            $table->enum('estado', ['activo', 'inactivo'])->default('activo')->after('numero_frente');

            // Índices para mejorar performance en búsquedas
            $table->index('id_faena');
            $table->index('estado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('frentes_trabajo', function (Blueprint $table) {
            $table->dropIndex(['id_faena']);
            $table->dropIndex(['estado']);
            $table->dropColumn(['id_faena', 'estado']);
        });
    }
};
