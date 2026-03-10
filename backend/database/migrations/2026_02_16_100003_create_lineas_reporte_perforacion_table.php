<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lineas_reporte_perforacion', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_reporte')
                ->constrained('reportes_perforacion')
                ->cascadeOnDelete();
            $table->foreignId('id_frente_trabajo')
                ->constrained('frentes_trabajo');
            $table->foreignId('id_personal')
                ->constrained('personal_autorizado_explosivos');
            $table->foreignId('id_tipo_frente')
                ->constrained('tipos_frente')
                ->comment('Tipo de labor');
            $table->decimal('seccion_ancho', 6, 2)->nullable()
                ->comment('Sección A');
            $table->decimal('seccion_alto', 6, 2)->nullable()
                ->comment('Sección H');
            $table->integer('numero_tiros');
            $table->decimal('largo_perforacion', 6, 2);
            $table->json('barras_usadas')->nullable()
                ->comment('Array: [0.8, 1.2, 1.8, ...]');
            $table->string('material', 20)->nullable()
                ->comment('oxido, sulfuro, esteril');
            $table->boolean('valores_editados')->default(false)
                ->comment('Si el usuario modificó cálculos');
            $table->string('observaciones', 255)->nullable();
            $table->timestamps();

            $table->index('id_reporte');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lineas_reporte_perforacion');
    }
};
