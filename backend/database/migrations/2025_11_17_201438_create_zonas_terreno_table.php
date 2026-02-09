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
        Schema::create('zonas_terreno', function (Blueprint $table) {
            $table->id();

            // Nombre de la zona (ej: "Zona Norte", "Sector A")
            $table->string('nombre', 100);

            // Color para visualización en el mapa (hex)
            $table->string('color', 7)->default('#3B82F6'); // Azul por defecto

            // Coordenadas del polígono (JSON con array de puntos)
            // Ejemplo: [{"x": 100, "y": 50}, {"x": 200, "y": 50}, ...]
            $table->json('coordenadas')->nullable();

            // Descripción opcional
            $table->text('descripcion')->nullable();

            // Activa/Inactiva
            $table->boolean('activa')->default(true);

            // Faena (si tienes múltiples faenas)
            $table->unsignedBigInteger('id_faena')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Índices
            $table->index('activa');
            $table->index('id_faena');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('zonas_terreno');
    }
};
