<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Agrega la columna numero_paladas a mezcla_dumpada para permitir
     * uso parcial de dumpadas (solo X paladas de una dumpada en esta mezcla).
     *
     * NULL = dumpada completa incluida (comportamiento legado)
     * > 0  = solo esas paladas fueron tomadas de la dumpada
     */
    public function up(): void
    {
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            $table->decimal('numero_paladas', 8, 2)
                ->nullable()
                ->after('toneladas')
                ->comment('Paladas tomadas de la dumpada. NULL = dumpada completa (legado). > 0 = uso parcial.');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mezcla_dumpada', function (Blueprint $table) {
            $table->dropColumn('numero_paladas');
        });
    }
};
