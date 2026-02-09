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
        Schema::create('acopios', function (Blueprint $table) {
            $table->id();

            // Identificadores del acopio
            $table->string('numero_acopio', 50); // A-001, A-002, etc.
            $table->string('codigo_acopio', 150); // ZN-PM-A001-27-11-2025
            $table->string('nombre', 200)->nullable(); // Nombre personalizado para acopios manuales

            // Tipo de acopio
            $table->enum('tipo', ['AUTOMATICO', 'MANUAL'])->default('AUTOMATICO');

            // Criterios de agrupación (para acopios automáticos)
            $table->foreignId('id_frente_trabajo')
                ->nullable()
                ->constrained('frentes_trabajo')
                ->onDelete('set null');
            $table->string('jornada', 50)->nullable(); // AM, PM, Madrugada, Noche
            $table->date('fecha')->nullable();

            // Totales calculados
            $table->decimal('total_toneladas', 10, 2)->default(0);
            $table->decimal('ley_promedio', 8, 3)->nullable();
            $table->integer('cantidad_dumpadas')->default(0);

            // Estado del acopio
            $table->enum('estado', ['ABIERTO', 'CERRADO', 'EN_MEZCLA'])->default('ABIERTO');

            // Observaciones
            $table->text('observaciones')->nullable();

            // Usuario que lo creó
            $table->unsignedBigInteger('user_id')->nullable();

            $table->timestamps();

            // Índices para búsquedas rápidas
            $table->index(['id_frente_trabajo', 'jornada', 'fecha']);
            $table->index('estado');
            $table->index('tipo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('acopios');
    }
};
