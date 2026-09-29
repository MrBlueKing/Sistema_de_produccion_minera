<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Patente del segundo camión en un viaje con transbordo (el que recoge
     * el material en el punto de transbordo y lo lleva a la planta final).
     * El primer camión sigue siendo el campo `patente` de siempre. El
     * transbordo en sí (punto, si aplica) vive en el LOTE, no acá -- ver
     * 2026_09_21_140100_add_transbordo_fields_to_lotes_table.
     */
    public function up(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            $table->string('patente_camion_2', 20)
                ->nullable()
                ->after('patente')
                ->comment('Patente del camión que recoge en el punto de transbordo del Lote y entrega en planta final');
        });
    }

    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            $table->dropColumn('patente_camion_2');
        });
    }
};
