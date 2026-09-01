<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tarifa mensual de compra de cobre (Circular ENAMI), usada para calcular
     * el Saldo Líquido esperado de un lote y compararlo contra la liquidación
     * real (ver session_produccion_2026_08_26 y el Excel de verificación del
     * usuario, que reproduce esta misma fórmula 1 a 1 contra L 41356).
     */
    public function up(): void
    {
        Schema::create('tarifas', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('mes');
            $table->unsignedSmallInteger('anio');
            $table->decimal('tarifa_base', 12, 4);
            $table->decimal('escala', 12, 4);
            $table->decimal('fondo_estabilizacion', 12, 4);
            $table->decimal('ley_base', 5, 2)->default(2.5);
            $table->decimal('iva_porcentaje', 5, 4)->default(0.19);
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->unique(['mes', 'anio']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tarifas');
    }
};
