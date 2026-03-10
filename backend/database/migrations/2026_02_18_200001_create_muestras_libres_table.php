<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('muestras_libres', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedInteger('id_faena')->nullable();
            $table->unsignedBigInteger('id_frente_trabajo')->nullable();
            $table->string('nombre', 200);           // Descripción libre de la muestra
            $table->string('solicitante', 150)->nullable(); // Área o persona que solicita
            $table->date('fecha');
            $table->string('estado', 50)->default('Ingresado'); // Ingresado | Completado
            // Resultados de laboratorio
            $table->decimal('ley', 8, 3)->nullable();
            $table->decimal('ley_cup', 8, 3)->nullable();
            $table->decimal('cu_soluble', 8, 3)->nullable();
            $table->decimal('cu_insoluble', 8, 3)->nullable();
            $table->string('rango', 50)->nullable();
            $table->string('certificado', 100)->nullable();
            $table->timestamps();

            $table->foreign('id_frente_trabajo')->references('id')->on('frentes_trabajo')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('muestras_libres');
    }
};
