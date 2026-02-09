<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Tabla EMPRESAS: Empresas que venden mineral a las plantas
     */
    public function up(): void
    {
        Schema::create('empresas', function (Blueprint $table) {
            $table->id();

            // Nombre de la empresa
            $table->string('nombre', 150)->unique();

            // Código o identificador corto (ej: "SA", "MDFI", "SYCJ")
            $table->string('codigo', 50)->nullable()->unique();

            // RUT de la empresa
            $table->string('rut', 20)->nullable()->unique();

            // Contacto
            $table->string('contacto', 150)->nullable();
            $table->string('telefono', 50)->nullable();
            $table->string('email', 150)->nullable();

            // Estado activo/inactivo
            $table->boolean('activo')->default(true);

            $table->timestamps();

            // Índices
            $table->index('nombre');
            $table->index('codigo');
            $table->index('activo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('empresas');
    }
};
