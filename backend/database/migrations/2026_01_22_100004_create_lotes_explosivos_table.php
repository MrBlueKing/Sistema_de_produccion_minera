<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabla de lotes de explosivos para trazabilidad
     */
    public function up(): void
    {
        Schema::create('lotes_explosivos', function (Blueprint $table) {
            $table->id();
            $table->string('numero_lote', 100)
                ->comment('Número de lote del fabricante');
            $table->foreignId('id_tipo_explosivo')
                ->constrained('tipos_explosivos')
                ->comment('Tipo de explosivo');
            $table->foreignId('id_polvorin')
                ->constrained('polvorines')
                ->comment('Polvorín donde está almacenado');
            $table->date('fecha_fabricacion')->nullable()
                ->comment('Fecha de fabricación del lote');
            $table->date('fecha_vencimiento')->nullable()
                ->comment('Fecha de vencimiento del lote');
            $table->date('fecha_ingreso')
                ->comment('Fecha de ingreso al polvorín');
            $table->string('guia_despacho', 100)->nullable()
                ->comment('Número de guía de despacho del proveedor');
            $table->string('proveedor', 150)->nullable()
                ->comment('Nombre del proveedor');
            $table->decimal('cantidad_inicial', 12, 2)
                ->comment('Cantidad que ingresó inicialmente');
            $table->decimal('cantidad_actual', 12, 2)
                ->comment('Cantidad actual disponible');
            $table->string('estado', 30)->default('Activo')
                ->comment('Activo, Agotado, Vencido, Devuelto');
            $table->foreignId('id_faena')
                ->comment('Faena asociada (MULTI-TENANCY)');
            $table->foreignId('user_id')->nullable()
                ->comment('Usuario que registró el lote');
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->unique(['numero_lote', 'id_tipo_explosivo', 'id_polvorin'], 'lotes_explosivos_unique');
            $table->index(['id_tipo_explosivo', 'estado']);
            $table->index('fecha_vencimiento');
            $table->index('id_faena');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lotes_explosivos');
    }
};
