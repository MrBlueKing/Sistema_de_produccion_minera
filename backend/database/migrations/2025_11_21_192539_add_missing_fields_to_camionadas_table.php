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
        Schema::table('camionadas', function (Blueprint $table) {
            // Agregar numero_guia si no existe
            if (!Schema::hasColumn('camionadas', 'numero_guia')) {
                $table->string('numero_guia', 50)
                    ->nullable()
                    ->after('ticket')
                    ->comment('Número de guía de despacho');
            }

            // Agregar cliente si no existe
            if (!Schema::hasColumn('camionadas', 'cliente')) {
                $table->string('cliente', 150)
                    ->nullable()
                    ->after('planta')
                    ->comment('Cliente destino');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            // Eliminar campos agregados
            if (Schema::hasColumn('camionadas', 'numero_guia')) {
                $table->dropColumn('numero_guia');
            }

            if (Schema::hasColumn('camionadas', 'cliente')) {
                $table->dropColumn('cliente');
            }
        });
    }
};
