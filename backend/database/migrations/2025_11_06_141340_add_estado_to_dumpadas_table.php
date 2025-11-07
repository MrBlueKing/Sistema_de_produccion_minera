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
        Schema::table('dumpadas', function (Blueprint $table) {
            // Estados: Ingresado, En Análisis, Completado
            $table->enum('estado', ['Ingresado', 'En Análisis', 'Completado'])
                  ->default('Ingresado')
                  ->after('rango');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            $table->dropColumn('estado');
        });
    }
};
