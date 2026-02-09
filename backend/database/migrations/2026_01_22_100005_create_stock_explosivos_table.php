<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabla de stock actual de explosivos por polvorín/tipo
     * Esta tabla es una vista materializada del stock calculado
     */
    public function up(): void
    {
        Schema::create('stock_explosivos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('id_polvorin')
                ->constrained('polvorines')
                ->comment('Polvorín donde está el stock');
            $table->foreignId('id_tipo_explosivo')
                ->constrained('tipos_explosivos')
                ->comment('Tipo de explosivo');
            $table->decimal('cantidad', 12, 2)->default(0)
                ->comment('Cantidad total disponible');
            $table->decimal('cantidad_reservada', 12, 2)->default(0)
                ->comment('Cantidad reservada para tronaduras programadas');
            $table->foreignId('id_faena')
                ->comment('Faena asociada (MULTI-TENANCY)');
            $table->timestamps();

            $table->unique(['id_polvorin', 'id_tipo_explosivo'], 'stock_explosivos_unique');
            $table->index('id_faena');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_explosivos');
    }
};
