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
            // Agregar mezcla_id (origen de la camionada)
            $table->foreignId('mezcla_id')
                ->after('lote_venta_id')
                ->nullable()
                ->constrained('mezclas')
                ->onDelete('set null');

            // Agregar peso_real (peso pesado en destino)
            $table->decimal('peso_real', 10, 2)
                ->after('peso')
                ->nullable()
                ->comment('Peso real recibido en destino');

            // Agregar diferencia_ley (diferencia entre ley esperada y real)
            $table->decimal('diferencia_ley', 8, 3)
                ->after('ley_lab_camion')
                ->nullable()
                ->comment('Diferencia entre ley mezcla y ley laboratorio');

            // Agregar porcentaje_error_ley (% de error en ley)
            $table->decimal('porcentaje_error_ley', 5, 2)
                ->after('diferencia_ley')
                ->nullable()
                ->comment('% de error en ley');

            // Agregar índice para mezcla_id
            $table->index('mezcla_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('camionadas', function (Blueprint $table) {
            // Eliminar campos agregados
            $table->dropForeign(['mezcla_id']);
            $table->dropIndex(['mezcla_id']);
            $table->dropColumn(['mezcla_id', 'peso_real', 'diferencia_ley', 'porcentaje_error_ley']);
        });
    }
};
