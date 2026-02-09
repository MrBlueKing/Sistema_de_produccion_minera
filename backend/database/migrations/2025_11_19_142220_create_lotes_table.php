<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Tabla LOTES: Grupos de despacho de camionadas a una planta
     * Un lote agrupa varias camionadas que se envían a una planta específica
     */
    public function up(): void
    {
        Schema::create('lotes', function (Blueprint $table) {
            $table->id();

            // Número de lote (ej: "L-001", "L-002")
            $table->string('numero_lote', 50)->unique();

            // Planta destino
            $table->foreignId('planta_id')
                ->constrained('plantas')
                ->onDelete('restrict');

            // Fecha de creación del lote
            $table->date('fecha_creacion');

            // Fecha estimada de llegada
            $table->date('fecha_estimada_llegada')->nullable();

            // Estado del lote
            $table->enum('estado', [
                'En Preparación',
                'Despachado',
                'En Tránsito',
                'Recibido',
                'Completado'
            ])->default('En Preparación');

            // Observaciones generales del lote
            $table->text('observaciones')->nullable();

            // Usuario que creó el lote
            $table->unsignedBigInteger('user_id')->nullable();

            $table->timestamps();

            // Índices
            $table->index('numero_lote');
            $table->index('planta_id');
            $table->index('fecha_creacion');
            $table->index('estado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lotes');
    }
};
