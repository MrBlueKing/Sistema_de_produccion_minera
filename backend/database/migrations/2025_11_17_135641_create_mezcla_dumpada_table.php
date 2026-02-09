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
        Schema::create('mezcla_dumpada', function (Blueprint $table) {
            $table->id();

            // Relación con mezcla
            $table->foreignId('mezcla_id')
                ->constrained('mezclas')
                ->onDelete('cascade');

            // Relación con dumpada (NULL si es remanente)
            $table->foreignId('dumpada_id')
                ->nullable()
                ->constrained('dumpadas')
                ->onDelete('set null');

            // Tipo de registro: DUMP (dumpada) o REM (remanente)
            $table->enum('tipo', ['DUMP', 'REM'])->default('DUMP');

            // Origen del registro (descripción, especialmente útil para remanentes)
            // Ejemplo: "Stock CZ1223: 4 paladas"
            $table->string('origen', 150)->nullable();

            // Datos de la dumpada/remanente en el momento de incluirla en la mezcla
            $table->decimal('toneladas', 8, 2);

            // Ley dump AJUSTADA (ley original - 0.009)
            $table->decimal('ley_dump_ajustada', 8, 3)->nullable()->comment('Ley dump con ajuste -0.009');

            $table->decimal('ley_visual', 8, 3)->nullable();
            $table->decimal('ley_lote', 8, 3)->nullable();

            $table->timestamps();

            // Índices
            $table->index('mezcla_id');
            $table->index('dumpada_id');
            $table->index('tipo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mezcla_dumpada');
    }
};
