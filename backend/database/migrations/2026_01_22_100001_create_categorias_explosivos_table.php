<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabla de categorías de explosivos (Iniciadores, Rompedores, Accesorios, etc.)
     */
    public function up(): void
    {
        Schema::create('categorias_explosivos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100)->unique()
                ->comment('Nombre de la categoría: Iniciadores, Rompedores, Accesorios');
            $table->text('descripcion')->nullable()
                ->comment('Descripción detallada de la categoría');
            $table->integer('orden')->default(0)
                ->comment('Orden de visualización');
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categorias_explosivos');
    }
};
