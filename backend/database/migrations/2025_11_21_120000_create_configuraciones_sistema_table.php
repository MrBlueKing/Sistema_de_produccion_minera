<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabla para almacenar configuraciones del sistema
     */
    public function up(): void
    {
        Schema::create('configuraciones_sistema', function (Blueprint $table) {
            $table->id();
            $table->string('clave', 100)->unique()->comment('Clave única de configuración');
            $table->text('valor')->comment('Valor de la configuración');
            $table->string('tipo', 20)->default('string')->comment('Tipo: string, number, boolean, json');
            $table->text('descripcion')->nullable()->comment('Descripción de qué hace esta configuración');
            $table->foreignId('updated_by')->nullable()->constrained('users')->comment('Último usuario que modificó');
            $table->timestamps();

            $table->index('clave');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('configuraciones_sistema');
    }
};
