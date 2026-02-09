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
        Schema::create('camionadas', function (Blueprint $table) {
            $table->id();

            // Relación con el lote de venta
            $table->foreignId('lote_venta_id')
                ->constrained('lotes_venta')
                ->onDelete('cascade');

            // Número de camionada dentro del lote (1, 2, 3, 4...)
            $table->unsignedInteger('numero_camionada');

            // Ticket de entrega (ID del ticket físico)
            $table->string('ticket', 100)->nullable();

            // Patente del camión
            $table->string('patente', 20);

            // Fechas de despacho y recepción
            $table->date('fecha_despacho');
            $table->date('fecha_recepcion')->nullable();

            // Horas de despacho y recepción
            $table->time('hora_despacho')->nullable();
            $table->time('hora_recepcion')->nullable();

            // Peso despachado en esta camionada (toneladas)
            $table->decimal('peso', 10, 2)->comment('Toneladas despachadas');

            // Leyes
            $table->decimal('ley_mezcla', 8, 3)->nullable()->comment('Ley teórica de la mezcla');
            $table->decimal('ley_visual', 8, 3)->nullable()->comment('Ley estimada visual');
            $table->decimal('ley_lab_camion', 8, 3)->nullable()->comment('Ley real analizada en laboratorio');

            // Mezcla de origen (puede ser diferente si el lote tiene múltiples mezclas)
            $table->foreignId('mezcla_id')
                ->nullable()
                ->constrained('mezclas')
                ->onDelete('set null');

            // Diferencia y error
            $table->decimal('diferencia', 10, 2)->nullable()->comment('Diferencia en toneladas vs teórico');
            $table->decimal('porcentaje_error', 5, 2)->nullable()->comment('% de error');

            // Estado de la camionada
            $table->enum('estado', ['Despachado', 'En Tránsito', 'Recibido', 'Completado'])->default('Despachado');

            // Observaciones
            $table->text('observaciones')->nullable();

            // Usuario que registró el despacho
            $table->unsignedBigInteger('user_id')->nullable();

            $table->timestamps();

            // Índices
            $table->index('lote_venta_id');
            $table->index('numero_camionada');
            $table->index('patente');
            $table->index('fecha_despacho');
            $table->index('estado');
            $table->index('mezcla_id');

            // Constraint: número de camionada único por lote
            $table->unique(['lote_venta_id', 'numero_camionada']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('camionadas');
    }
};
