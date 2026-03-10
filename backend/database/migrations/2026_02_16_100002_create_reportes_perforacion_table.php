<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reportes_perforacion', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 50)->unique()
                ->comment('Auto: RPT-{año}-{secuencial}');
            $table->date('fecha');
            $table->string('turno', 20)
                ->comment('AM, PM, Noche');
            $table->string('estado', 20)->default('borrador')
                ->comment('borrador, confirmado, cerrado');
            $table->text('observaciones')->nullable();
            $table->string('confirmado_por', 150)->nullable();
            $table->dateTime('fecha_confirmacion')->nullable();
            $table->foreignId('id_polvorin')
                ->constrained('polvorines');
            $table->foreignId('id_faena')
                ->comment('Faena asociada (MULTI-TENANCY)');
            $table->foreignId('user_id')->nullable()
                ->comment('Usuario que creó el reporte');
            $table->timestamps();

            $table->index(['fecha', 'turno']);
            $table->index('estado');
            $table->index('id_faena');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reportes_perforacion');
    }
};
