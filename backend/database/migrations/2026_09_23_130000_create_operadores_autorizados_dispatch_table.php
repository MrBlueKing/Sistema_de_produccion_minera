<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Operadores que aparecen en el selector "Operador" del Ingreso de Dumpadas,
     * por faena. Mismo patron que personal_autorizado_explosivos: se elige gente
     * del personal interno de Petroleo (id_personal_externo, sin FK porque es
     * otra BD) y se guarda una foto de nombre/cargo, asi el Ingreso no depende de
     * que Petroleo responda. Quitar = activo false (no se borra).
     */
    public function up(): void
    {
        Schema::create('operadores_autorizados_dispatch', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_personal_externo');
            $table->string('rut', 12)->nullable();
            $table->string('nombre', 150);
            $table->string('cargo', 150)->nullable();
            $table->unsignedBigInteger('id_faena');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['id_personal_externo', 'id_faena'], 'op_aut_dispatch_persona_faena_unique');
            $table->index(['id_faena', 'activo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operadores_autorizados_dispatch');
    }
};
