<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabla de movimientos de explosivos (entradas, salidas, transferencias, ajustes)
     */
    public function up(): void
    {
        Schema::create('movimientos_explosivos', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 50)->unique()
                ->comment('Código único del movimiento, ej: MOV-2026-0001');
            $table->string('tipo', 30)
                ->comment('entrada, salida, transferencia, ajuste, devolucion');
            $table->foreignId('id_polvorin_origen')->nullable()
                ->constrained('polvorines')
                ->comment('Polvorín de origen (para salidas/transferencias)');
            $table->foreignId('id_polvorin_destino')->nullable()
                ->constrained('polvorines')
                ->comment('Polvorín de destino (para entradas/transferencias)');
            $table->foreignId('id_tipo_explosivo')
                ->constrained('tipos_explosivos')
                ->comment('Tipo de explosivo');
            $table->foreignId('id_lote')->nullable()
                ->constrained('lotes_explosivos')
                ->comment('Lote específico (si aplica trazabilidad)');
            $table->decimal('cantidad', 12, 2)
                ->comment('Cantidad del movimiento');
            $table->foreignId('id_tronadura')->nullable()
                ->constrained('tronaduras')
                ->comment('Tronadura asociada (para salidas)');
            $table->date('fecha')
                ->comment('Fecha del movimiento');
            $table->time('hora')->nullable()
                ->comment('Hora del movimiento');
            $table->string('autorizado_por', 150)->nullable()
                ->comment('Nombre de quien autorizó');
            $table->string('recibido_por', 150)->nullable()
                ->comment('Nombre de quien recibió');
            $table->string('entregado_por', 150)->nullable()
                ->comment('Nombre de quien entregó');
            $table->string('guia_despacho', 100)->nullable()
                ->comment('Número de guía (para entradas)');
            $table->string('motivo', 255)->nullable()
                ->comment('Motivo del movimiento (especialmente para ajustes)');
            $table->text('observaciones')->nullable();
            $table->foreignId('id_faena')
                ->comment('Faena asociada (MULTI-TENANCY)');
            $table->foreignId('user_id')->nullable()
                ->comment('Usuario que registró');
            $table->timestamps();

            $table->index(['tipo', 'fecha']);
            $table->index('id_tronadura');
            $table->index('id_faena');
            $table->index('fecha');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimientos_explosivos');
    }
};
