<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabla para registrar las tronaduras/disparos/explosiones en la mina
     * Cada tronadura genera múltiples dumpadas del mismo origen
     */
    public function up(): void
    {
        Schema::create('tronaduras', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 50)->unique()->comment('Código único de la tronadura, ej: TR-2025-001');
            $table->foreignId('id_frente_trabajo')->constrained('frentes_trabajo')->comment('Frente donde se realizó la tronadura');
            $table->date('fecha')->comment('Fecha de la tronadura');
            $table->time('hora')->nullable()->comment('Hora aproximada del disparo');
            $table->string('jornada', 20)->nullable()->comment('AM, PM, Madrugada, Noche');
            $table->decimal('toneladas_estimadas', 10, 2)->nullable()->comment('Toneladas estimadas de material');
            $table->decimal('toneladas_reales', 10, 2)->nullable()->comment('Toneladas reales extraídas (suma de dumpadas)');
            $table->integer('dumpadas_estimadas')->nullable()->comment('Cantidad estimada de dumpadas');
            $table->integer('dumpadas_reales')->nullable()->comment('Cantidad real de dumpadas (calculado)');
            $table->string('estado', 30)->default('Activa')->comment('Activa, Completada, Cancelada');
            $table->text('observaciones')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->comment('Usuario que registró');
            $table->foreignId('id_faena')->nullable()->comment('Faena asociada');
            $table->timestamps();

            $table->index(['fecha', 'id_frente_trabajo']);
            $table->index('estado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tronaduras');
    }
};
