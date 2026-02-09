<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Tabla PLANTAS: Plantas de procesamiento/destino
     */
    public function up(): void
    {
        Schema::create('plantas', function (Blueprint $table) {
            $table->id();

            // Nombre de la planta
            $table->string('nombre', 150)->unique();

            // Código o identificador corto
            $table->string('codigo', 50)->nullable()->unique();

            // Descripción
            $table->text('descripcion')->nullable();

            // Dirección
            $table->string('direccion', 255)->nullable();

            // Capacidad de recepción (toneladas por día)
            $table->decimal('capacidad_diaria', 10, 2)->nullable();

            // Distancia desde la faena (km)
            $table->decimal('distancia_km', 8, 2)->nullable();

            // Relación con faena (si aplica)
            $table->unsignedBigInteger('id_faena')->nullable();

            // Relación con empresa (si aplica)
            $table->unsignedBigInteger('id_empresa')->nullable();

            // Estado activo/inactivo
            $table->boolean('activo')->default(true);

            $table->timestamps();

            // Índices
            $table->index('nombre');
            $table->index('codigo');
            $table->index('activo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plantas');
    }
};
