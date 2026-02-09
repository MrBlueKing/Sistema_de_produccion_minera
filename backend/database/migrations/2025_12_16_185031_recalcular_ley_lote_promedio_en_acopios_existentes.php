<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Dispatch\Acopio;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Recalcular ley_lote_promedio para todos los acopios existentes
        $acopios = Acopio::all();

        foreach ($acopios as $acopio) {
            $acopio->recalcularTotales();
        }

        echo "\n✓ Recalculados " . $acopios->count() . " acopios con el nuevo campo ley_lote_promedio\n";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No hay acción de reversión necesaria
        // Los datos pueden quedarse tal como están
    }
};
