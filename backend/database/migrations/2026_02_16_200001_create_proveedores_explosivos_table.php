<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proveedores_explosivos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 200);
            $table->string('rut', 20)->nullable();
            $table->string('direccion', 300)->nullable();
            $table->string('telefono', 50)->nullable();
            $table->string('contacto', 150)->nullable();
            $table->boolean('activo')->default(true);
            $table->unsignedBigInteger('id_faena')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proveedores_explosivos');
    }
};
