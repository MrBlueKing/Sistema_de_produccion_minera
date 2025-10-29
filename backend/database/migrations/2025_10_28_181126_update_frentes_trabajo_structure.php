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
            // Nuevas columnas según la estructura que definimos
            $table->string('manto', 10)->after('id');
            $table->string('calle', 20)->nullable()->after('manto');
            $table->string('hebra', 10)->nullable()->after('calle');
            $table->string('nivel', 10)->nullable()->after('hebra');
            $table->string('codigo_completo', 100)->nullable()->after('nivel');

            // Opcional: eliminar el campo antiguo 'nombre' si ya no lo necesitas
            $table->dropColumn('nombre');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('frentes_trabajo', function (Blueprint $table) {
            $table->dropColumn(['manto', 'calle', 'hebra', 'nivel', 'codigo_completo']);
        });
    }
};
