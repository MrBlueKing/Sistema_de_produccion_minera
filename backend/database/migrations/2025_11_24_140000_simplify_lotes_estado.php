<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Simplificar estados de lotes: solo "Abierto" y "Completado"
     */
    public function up(): void
    {
        // Modificar columna de estado sin actualizar registros existentes
        // Los registros existentes se manejarán en el código
        Schema::table('lotes', function (Blueprint $table) {
            // Primero cambiar los valores existentes a uno de los nuevos estados válidos
            DB::statement("UPDATE lotes SET estado = 'Abierto' WHERE estado IN ('En Preparación', 'Despachado', 'En Tránsito', 'Recibido')");
            DB::statement("UPDATE lotes SET estado = 'Completado' WHERE estado = 'Completado'");

            // Ahora modificar la columna
            $table->enum('estado', ['Abierto', 'Completado'])
                ->default('Abierto')
                ->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            $table->enum('estado', [
                'En Preparación',
                'Despachado',
                'En Tránsito',
                'Recibido',
                'Completado'
            ])->default('En Preparación')->change();
        });
    }
};
