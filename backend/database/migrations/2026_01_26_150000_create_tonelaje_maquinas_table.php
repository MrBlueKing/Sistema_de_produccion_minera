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
        Schema::create('tonelaje_maquinas', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_maquina')->comment('ID de la maquina en sistema petroleo');
            $table->string('nombre_maquina', 100)->comment('Nombre de la maquina para referencia');
            $table->string('patente', 20)->nullable();
            $table->decimal('tonelaje', 8, 2)->comment('Tonelaje asignado a esta maquina');
            $table->unsignedBigInteger('id_faena')->nullable()->comment('NULL = aplica a todas las faenas');
            $table->boolean('activo')->default(true);
            $table->timestamps();

            // Una maquina puede tener un tonelaje diferente por faena
            $table->unique(['id_maquina', 'id_faena'], 'maquina_faena_unique');
            $table->index('id_faena');
            $table->index('activo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tonelaje_maquinas');
    }
};
