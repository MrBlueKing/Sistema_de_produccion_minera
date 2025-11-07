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
            // Renombrar columna 'nivel' a 'numero_frente'
            $table->renameColumn('nivel', 'numero_frente');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('frentes_trabajo', function (Blueprint $table) {
            // Revertir: renombrar 'numero_frente' de vuelta a 'nivel'
            $table->renameColumn('numero_frente', 'nivel');
        });
    }
};
