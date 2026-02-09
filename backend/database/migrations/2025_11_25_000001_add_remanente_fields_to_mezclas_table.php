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
        Schema::table('mezclas', function (Blueprint $table) {
            // Control de toneladas
            $table->decimal('toneladas_disponibles', 10, 2)->default(0)->after('total_ton')
                ->comment('Toneladas disponibles para despachar');
            $table->decimal('toneladas_despachadas', 10, 2)->default(0)->after('toneladas_disponibles')
                ->comment('Toneladas ya despachadas en camionadas');

            // Campos para remanentes
            $table->boolean('es_remanente')->default(false)->after('estado')
                ->comment('Indica si esta mezcla es un remanente de otra mezcla');
            $table->unsignedBigInteger('mezcla_origen_id')->nullable()->after('es_remanente')
                ->comment('ID de la mezcla de la cual proviene este remanente');
            $table->unsignedBigInteger('lote_origen_id')->nullable()->after('mezcla_origen_id')
                ->comment('ID del lote del cual se generó este remanente');

            // Foreign keys
            $table->foreign('mezcla_origen_id')->references('id')->on('mezclas')->onDelete('set null');
            $table->foreign('lote_origen_id')->references('id')->on('lotes')->onDelete('set null');

            // Índices
            $table->index('es_remanente');
            $table->index('mezcla_origen_id');
            $table->index('lote_origen_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('mezclas', function (Blueprint $table) {
            // Drop foreign keys first
            $table->dropForeign(['mezcla_origen_id']);
            $table->dropForeign(['lote_origen_id']);

            // Drop columns
            $table->dropColumn([
                'toneladas_disponibles',
                'toneladas_despachadas',
                'es_remanente',
                'mezcla_origen_id',
                'lote_origen_id'
            ]);
        });
    }
};
