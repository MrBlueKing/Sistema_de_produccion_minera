<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Tabla puente para relación muchos a muchos:
     * Un lote puede contener material de varias mezclas
     * Una mezcla puede ser usada en varios lotes
     */
    public function up(): void
    {
        Schema::create('lote_mezcla', function (Blueprint $table) {
            $table->id();

            // Relación con el lote
            $table->foreignId('lote_id')
                ->constrained('lotes_venta')
                ->onDelete('cascade');

            // Relación con la mezcla
            $table->foreignId('mezcla_id')
                ->constrained('mezclas')
                ->onDelete('restrict');

            // Peso de esta mezcla usado en este lote (en toneladas)
            // Puede ser solo una parte de la mezcla total
            $table->decimal('peso_usado', 10, 2)->comment('Toneladas de esta mezcla usadas en este lote');

            // Ley promedio de esta mezcla al momento de usarla
            $table->decimal('ley_mezcla', 8, 3)->nullable()->comment('Ley promedio de la mezcla');

            $table->timestamps();

            // Índices
            $table->index('lote_id');
            $table->index('mezcla_id');

            // Constraint: evitar duplicados
            $table->unique(['lote_id', 'mezcla_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lote_mezcla');
    }
};
