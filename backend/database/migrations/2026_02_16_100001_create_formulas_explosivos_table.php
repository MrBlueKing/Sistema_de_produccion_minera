<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('formulas_explosivos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_tipo_frente')
                ->constrained('tipos_frente')
                ->comment('Tipo de labor (Frente, Levante, DQ, etc.)');
            $table->foreignId('id_tipo_explosivo')
                ->constrained('tipos_explosivos')
                ->comment('Tipo de explosivo (ANFO, Emulsión, etc.)');
            $table->decimal('factor', 8, 4)
                ->comment('Multiplicador: cantidad = n_tiros × factor');
            $table->foreignId('id_faena')
                ->comment('Faena asociada (MULTI-TENANCY)');
            $table->timestamps();

            $table->unique(['id_tipo_frente', 'id_tipo_explosivo', 'id_faena'], 'formulas_tipo_frente_explosivo_faena_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('formulas_explosivos');
    }
};
