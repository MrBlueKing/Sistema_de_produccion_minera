<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Auditoría de movimientos de camionadas entre lotes (reasignaciones
     * manuales, ej. consolidar 2 lotes en 1 por falta de capacidad en planta).
     */
    public function up(): void
    {
        Schema::create('camionada_movimientos', function (Blueprint $table) {
            $table->id();

            $table->foreignId('camionada_id')
                ->constrained('camionadas')
                ->onDelete('cascade');

            $table->foreignId('lote_origen_id')
                ->nullable()
                ->constrained('lotes')
                ->onDelete('set null');

            $table->foreignId('lote_destino_id')
                ->constrained('lotes')
                ->onDelete('cascade');

            $table->unsignedBigInteger('user_id')->nullable();

            $table->timestamps();

            $table->index('camionada_id');
            $table->index('lote_origen_id');
            $table->index('lote_destino_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('camionada_movimientos');
    }
};
