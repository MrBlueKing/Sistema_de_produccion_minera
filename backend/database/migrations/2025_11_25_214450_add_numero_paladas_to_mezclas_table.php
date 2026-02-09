<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Agregar campo numero_paladas para registrar cuántas paladas
     * se usaron para crear el remanente de una mezcla
     */
    public function up(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->unsignedInteger('numero_paladas')
                ->nullable()
                ->after('es_descarte')
                ->comment('Número de paladas usadas para crear este remanente (opcional)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            $table->dropColumn('numero_paladas');
        });
    }
};
