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
        Schema::create('lotes_venta', function (Blueprint $table) {
            $table->id();

            // Número de lote de venta (ej: "500", "501")
            $table->string('numero_lote', 50)->unique();

            // Relación con la mezcla utilizada
            $table->foreignId('mezcla_id')
                ->constrained('mezclas')
                ->onDelete('restrict');

            // Cliente/Destino (ej: "MDF Inés", "Planta Procesadora")
            $table->string('cliente', 150);

            // Fecha de envío/venta
            $table->date('fecha_envio');

            // Peso enviado en toneladas (puede ser menor que el total de la mezcla)
            $table->decimal('peso_enviado', 10, 2);

            // Ley de laboratorio del lote vendido (resultado de análisis)
            $table->decimal('ley_lab', 8, 3)->nullable()->comment('Ley de laboratorio del lote');

            // Diferencia entre peso de mezcla y peso enviado (genera remanente)
            $table->decimal('peso_remanente', 10, 2)->default(0)->comment('Peso que sobró (remanente)');

            // Porcentaje de error o diferencia
            $table->decimal('porcentaje_error', 5, 2)->nullable()->comment('% diferencia entre ley esperada y ley lab');

            // Estado del lote
            $table->enum('estado', ['Preparado', 'Enviado', 'Completado'])->default('Preparado');

            // Observaciones
            $table->text('observaciones')->nullable();

            // Usuario que creó el lote
            $table->unsignedBigInteger('user_id')->nullable();

            $table->timestamps();

            // Índices
            $table->index('numero_lote');
            $table->index('mezcla_id');
            $table->index('fecha_envio');
            $table->index('estado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lotes_venta');
    }
};
