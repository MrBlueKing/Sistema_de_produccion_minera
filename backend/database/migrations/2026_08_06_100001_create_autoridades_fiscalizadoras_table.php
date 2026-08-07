<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Catálogo de Autoridades Fiscalizadoras (DGMN) — código "F/A" que exige el
     * libro de control de explosivos, ej: 22 = Los Andes. No es por faena: es
     * jurisdicción regional, se asigna una a cada polvorín en su configuración.
     */
    public function up(): void
    {
        Schema::create('autoridades_fiscalizadoras', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 20)
                ->comment('Código F/A asignado por la DGMN, ej: 22');
            $table->string('nombre', 150)
                ->comment('Nombre de la autoridad fiscalizadora, ej: Los Andes');
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('autoridades_fiscalizadoras');
    }
};
