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
            // Eliminar columna1
            $table->dropColumn('columna1');

            // Modificar jornada a ENUM
            $table->enum('jornada', ['AM', 'PM', 'Madrugada', 'Noche'])->nullable()->change();

            // Hacer que acopios sea generado automáticamente (no nullable para forzar generación)
            $table->string('acopios', 150)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            // Restaurar columna1
            $table->string('columna1', 100)->nullable();

            // Volver jornada a string
            $table->string('jornada', 50)->nullable()->change();

            // Restaurar acopios
            $table->string('acopios', 100)->nullable()->change();
        });
    }
};
