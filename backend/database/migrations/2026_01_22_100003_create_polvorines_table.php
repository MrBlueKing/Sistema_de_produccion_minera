<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabla de polvorines (ubicaciones de almacenamiento de explosivos)
     * Cada faena tiene 1 polvorín
     */
    public function up(): void
    {
        Schema::create('polvorines', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 30)->unique()
                ->comment('Código único del polvorín');
            $table->string('nombre', 150)
                ->comment('Nombre descriptivo del polvorín');
            $table->string('ubicacion', 255)->nullable()
                ->comment('Ubicación física del polvorín');
            $table->decimal('capacidad_maxima_kg', 12, 2)->nullable()
                ->comment('Capacidad máxima en kg');
            $table->string('responsable', 150)->nullable()
                ->comment('Nombre del polvorinero responsable');
            $table->string('telefono_responsable', 50)->nullable();
            $table->foreignId('id_faena')
                ->comment('Faena a la que pertenece (1 polvorín por faena)');
            $table->text('observaciones')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique('id_faena', 'polvorines_id_faena_unique');
            $table->index('activo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('polvorines');
    }
};
