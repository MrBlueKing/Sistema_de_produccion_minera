<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Catálogo de tipos de explosivos (ANFO, Emulsión, Detonadores, etc.)
     */
    public function up(): void
    {
        Schema::create('tipos_explosivos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 30)->unique()
                ->comment('Código único del explosivo, ej: ANFO-STD');
            $table->string('nombre', 150)
                ->comment('Nombre completo del explosivo');
            $table->foreignId('id_categoria')
                ->constrained('categorias_explosivos')
                ->comment('Categoría del explosivo');
            $table->string('unidad_medida', 20)
                ->comment('kg, unidades, metros');
            $table->boolean('requiere_lote')->default(true)
                ->comment('Si requiere control por lote del fabricante');
            $table->integer('dias_alerta_vencimiento')->default(30)
                ->comment('Días antes de vencimiento para alertar');
            $table->decimal('stock_minimo', 12, 2)->default(0)
                ->comment('Stock mínimo para alerta de reposición');
            $table->decimal('stock_maximo', 12, 2)->nullable()
                ->comment('Stock máximo permitido');
            $table->string('fabricante', 150)->nullable()
                ->comment('Fabricante del explosivo');
            $table->string('clasificacion_onu', 50)->nullable()
                ->comment('Clasificación ONU para transporte');
            $table->text('descripcion')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->index('id_categoria');
            $table->index('activo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tipos_explosivos');
    }
};
