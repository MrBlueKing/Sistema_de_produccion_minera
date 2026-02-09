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
            // Renombrar n_acop a numero_dumpada
            $table->renameColumn('n_acop', 'numero_dumpada');

            // El campo acopios almacena el código COMPLETO del acopio
            // Formato: {frente}-{jornada}-{numero_acopio}-{fecha}
            // Ejemplo: "ZN-PM-DIA-A001-27-11-2025"
            $table->string('acopios')->nullable()->comment('Código completo del acopio (ej: ZN-PM-DIA-A001-27-11-2025)')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('dumpadas', function (Blueprint $table) {
            // Revertir el renombre
            $table->renameColumn('numero_dumpada', 'n_acop');

            // Revertir comentario
            $table->string('acopios')->nullable()->comment('')->change();
        });
    }
};
