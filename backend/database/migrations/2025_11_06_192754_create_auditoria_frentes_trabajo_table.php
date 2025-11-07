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
        Schema::create('auditoria_frentes_trabajo', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_frente_trabajo')->constrained('frentes_trabajo')->onDelete('cascade');
            $table->enum('accion', ['creado', 'actualizado', 'eliminado', 'restaurado']); // Tipo de acción
            $table->string('usuario')->nullable(); // Usuario que realizó la acción
            $table->json('datos_anteriores')->nullable(); // Estado anterior (JSON)
            $table->json('datos_nuevos')->nullable(); // Estado nuevo (JSON)
            $table->text('observaciones')->nullable(); // Notas adicionales
            $table->timestamps();

            // Índices para búsquedas rápidas
            $table->index('id_frente_trabajo');
            $table->index('accion');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('auditoria_frentes_trabajo');
    }
};
