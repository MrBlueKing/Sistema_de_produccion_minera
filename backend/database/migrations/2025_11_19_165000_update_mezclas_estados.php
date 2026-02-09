<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Primero ampliar el ENUM para incluir tanto valores antiguos como nuevos
        DB::statement("ALTER TABLE mezclas MODIFY COLUMN estado ENUM('Pendiente', 'En Análisis', 'Completado', 'Confirmado', 'En Despacho', 'Despachado') NOT NULL DEFAULT 'Pendiente'");

        // Luego convertir estados antiguos a nuevos
        DB::statement("UPDATE mezclas SET estado = 'Confirmado' WHERE estado = 'Pendiente'");
        DB::statement("UPDATE mezclas SET estado = 'En Despacho' WHERE estado = 'En Análisis'");
        DB::statement("UPDATE mezclas SET estado = 'Despachado' WHERE estado = 'Completado'");

        // Finalmente reducir el ENUM solo a los nuevos valores
        DB::statement("ALTER TABLE mezclas MODIFY COLUMN estado ENUM('Confirmado', 'En Despacho', 'Despachado') NOT NULL DEFAULT 'Confirmado'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revertir a estados antiguos
        DB::statement("UPDATE mezclas SET estado = 'Pendiente' WHERE estado = 'Confirmado'");
        DB::statement("UPDATE mezclas SET estado = 'En Análisis' WHERE estado = 'En Despacho'");
        DB::statement("UPDATE mezclas SET estado = 'Completado' WHERE estado = 'Despachado'");

        // Revertir la columna
        DB::statement("ALTER TABLE mezclas MODIFY COLUMN estado ENUM('Pendiente', 'En Análisis', 'Completado') NOT NULL DEFAULT 'Pendiente'");
    }
};
