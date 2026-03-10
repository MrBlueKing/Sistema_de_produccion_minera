<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('explosivos_linea_reporte', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_linea_reporte')
                ->constrained('lineas_reporte_perforacion')
                ->cascadeOnDelete();
            $table->foreignId('id_tipo_explosivo')
                ->constrained('tipos_explosivos');
            $table->decimal('cantidad_calculada', 12, 2)
                ->comment('Valor calculado por fórmula');
            $table->decimal('cantidad_final', 12, 2)
                ->comment('Valor final (editado o = calculada)');
            $table->timestamps();

            $table->index('id_linea_reporte');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('explosivos_linea_reporte');
    }
};
