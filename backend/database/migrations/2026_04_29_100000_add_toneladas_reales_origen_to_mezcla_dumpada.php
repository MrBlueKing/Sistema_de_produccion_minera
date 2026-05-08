<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            // Toneladas reales registradas en la mezcla origen al momento de usar paladas
            // Solo se llena cuando el remanente se crea por paladas (numero_paladas IS NOT NULL)
            $table->decimal('toneladas_reales_origen', 8, 2)->nullable()->after('numero_paladas');
        });
    }

    public function down(): void
    {
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            $table->dropColumn('toneladas_reales_origen');
        });
    }
};
