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
        Schema::create('mezclas', function (Blueprint $table) {
            $table->id();

            // Código único de la mezcla (ej: CZ1224)
            $table->string('codigo', 50)->unique();

            // Fecha de la mezcla
            $table->date('fecha');

            // Relación con faena (opcional, según estructura)
            $table->unsignedBigInteger('id_faena')->nullable();

            // Totales calculados
            $table->decimal('total_ton', 10, 2)->default(0);

            // Promedios ponderados por toneladas
            $table->decimal('ley_prom_dump', 8, 3)->nullable()->comment('Ley promedio dump (con ajuste -0.009)');
            $table->decimal('ley_prom_visual', 8, 3)->nullable()->comment('Ley promedio visual');
            $table->decimal('ley_prom_lote', 8, 3)->nullable()->comment('Ley promedio lote');

            // Resultado de laboratorio (ingresado posteriormente)
            $table->decimal('ley_lab', 8, 3)->nullable()->comment('Ley de laboratorio');

            // Estado de la mezcla
            // Confirmado: Mezcla creada y confirmada, lista para despacho
            // En Despacho: Se están generando camionadas desde esta mezcla
            // Despachado: Todo el material fue despachado
            $table->enum('estado', ['Confirmado', 'En Despacho', 'Despachado'])->default('Confirmado');

            // Observaciones
            $table->text('observaciones')->nullable();

            // Usuario que creó la mezcla
            $table->unsignedBigInteger('user_id')->nullable();

            $table->timestamps();

            // Índices
            $table->index('codigo');
            $table->index('fecha');
            $table->index('estado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mezclas');
    }
};
