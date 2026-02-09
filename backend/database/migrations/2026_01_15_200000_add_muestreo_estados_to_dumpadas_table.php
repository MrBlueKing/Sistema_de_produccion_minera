<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Agrega los estados de muestreo al ENUM de la columna estado en dumpadas
     */
    public function up(): void
    {
        // Modificar el ENUM para incluir los estados de muestreo
        DB::statement("ALTER TABLE dumpadas MODIFY COLUMN estado ENUM(
            'Ingresado',
            'En Análisis',
            'Completado',
            'Pendiente Muestreo',
            'Recibido',
            'En Proceso de Muestreo'
        ) NOT NULL DEFAULT 'Ingresado'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Primero actualizar registros con los nuevos estados al estado por defecto
        DB::statement("UPDATE dumpadas SET estado = 'Ingresado' WHERE estado IN ('Pendiente Muestreo', 'Recibido', 'En Proceso de Muestreo')");

        // Restaurar el ENUM original
        DB::statement("ALTER TABLE dumpadas MODIFY COLUMN estado ENUM(
            'Ingresado',
            'En Análisis',
            'Completado'
        ) NOT NULL DEFAULT 'Ingresado'");
    }
};
