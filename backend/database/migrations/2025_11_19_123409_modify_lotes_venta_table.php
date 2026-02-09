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
        Schema::table('lotes_venta', function (Blueprint $table) {
            // Eliminar la relación directa con una sola mezcla
            $table->dropForeign(['mezcla_id']);
            $table->dropColumn('mezcla_id');

            // Eliminar peso_enviado (ahora se calcula desde camionadas)
            $table->dropColumn('peso_enviado');

            // Eliminar peso_remanente (ya no aplica en este contexto)
            $table->dropColumn('peso_remanente');

            // Eliminar ley_lab (cada camionada tendrá su propia ley)
            $table->dropColumn('ley_lab');

            // Eliminar porcentaje_error (se calcula por camionada)
            $table->dropColumn('porcentaje_error');

            // Renombrar campos para mayor claridad
            $table->renameColumn('fecha_envio', 'fecha_creacion');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lotes_venta', function (Blueprint $table) {
            // Restaurar campos eliminados
            $table->foreignId('mezcla_id')
                ->after('numero_lote')
                ->constrained('mezclas')
                ->onDelete('restrict');

            $table->decimal('peso_enviado', 10, 2)->after('fecha_creacion');
            $table->decimal('ley_lab', 8, 3)->nullable()->after('peso_enviado');
            $table->decimal('peso_remanente', 10, 2)->default(0)->after('ley_lab');
            $table->decimal('porcentaje_error', 5, 2)->nullable()->after('peso_remanente');

            $table->renameColumn('fecha_creacion', 'fecha_envio');
        });
    }
};
