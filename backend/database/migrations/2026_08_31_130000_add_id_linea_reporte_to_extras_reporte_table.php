<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('extras_reporte', function (Blueprint $table) {
            // Nullable: un extra queda ligado a la línea (frente) que lo necesitó,
            // pero se deja null si esa línea no se puede volver a identificar de
            // forma confiable (ej. al descartar una corrección, las líneas se
            // recrean con id nuevo — ver ReportePerforacion::descartarCorreccion()).
            $table->foreignId('id_linea_reporte')->nullable()->after('id_reporte')
                ->constrained('lineas_reporte_perforacion')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('extras_reporte', function (Blueprint $table) {
            $table->dropForeign(['id_linea_reporte']);
            $table->dropColumn('id_linea_reporte');
        });
    }
};
