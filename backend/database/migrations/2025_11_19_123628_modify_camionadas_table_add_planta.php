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
        Schema::table('camionadas', function (Blueprint $table) {
            // Agregar campo para la planta de destino
            $table->string('planta', 100)->after('patente')->nullable()
                ->comment('Planta de destino (ej: SyC Juan, MDF Inés)');

            // Eliminar mezcla_id (ahora la mezcla viene del lote)
            $table->dropForeign(['mezcla_id']);
            $table->dropColumn('mezcla_id');

            // Modificar diferencia y porcentaje_error para que sean nullable
            // ya que se calculan después cuando se confirma el peso real
            $table->decimal('diferencia', 10, 2)->nullable()->change();
            $table->decimal('porcentaje_error', 5, 2)->nullable()->change();

            // Agregar índice para planta
            $table->index('planta');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            // Restaurar mezcla_id
            $table->foreignId('mezcla_id')
                ->after('ley_lab_camion')
                ->nullable()
                ->constrained('mezclas')
                ->onDelete('set null');

            // Eliminar planta
            $table->dropIndex(['planta']);
            $table->dropColumn('planta');
        });
    }
};
