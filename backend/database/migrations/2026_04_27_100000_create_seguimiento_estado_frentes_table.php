<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seguimiento_estado_frentes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('frente_trabajo_id')
                  ->constrained('frentes_trabajo')
                  ->onDelete('cascade');
            $table->tinyInteger('ventilacion')->unsigned(); // 1–5
            $table->enum('estabilidad', ['FC', 'PM', 'AC', 'CH', 'FO']);
            $table->unsignedSmallInteger('duracion_estimada'); // días
            $table->date('fecha_inicio_estimada');
            $table->date('fecha_inicio_real')->nullable();
            $table->text('observaciones')->nullable();
            $table->string('registrado_por'); // nombre del ingeniero
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seguimiento_estado_frentes');
    }
};
